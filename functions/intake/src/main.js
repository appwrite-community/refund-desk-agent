import { Client, ID, Permission, Query, Role, Storage, TablesDB, Tokens } from 'node-appwrite';
import { BUCKET_ID, DATABASE_ID, PHOTO_TOKEN_DAYS, TABLES } from './config.js';
import { HttpError, isId, validateReply, validateRequest } from './validate.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The number customers and staff see, for example #1043. */
const requestNumber = (row) => 1000 + Number(row.$sequence);

// Customers never write refund rows themselves: a row a user creates grants
// that user update and delete permissions by default. This function checks the
// order, locks the photo, and writes the row with read-only access instead.
export default async ({ req, res, error }) => {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) return res.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401);

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const services = {
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
    tokens: new Tokens(client),
  };

  try {
    const body = parseBody(req.bodyText);
    if (req.method === 'POST' && req.path === '/requests') {
      return res.json(await createRequest(services, userId, body), 201);
    }
    const replyRoute = req.path.match(/^\/requests\/([^/]+)\/replies$/);
    if (req.method === 'POST' && replyRoute) {
      return res.json(await createReply(services, userId, replyRoute[1], body), 201);
    }
    return res.json({ error: 'not_found', message: 'Unknown route.' }, 404);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.json({ error: err.code, message: err.message, ...err.extra }, err.status);
    }
    error(`Intake failed: ${err.code ?? ''} ${err.type ?? ''} ${err.message}`);
    return res.json({ error: 'internal_error', message: 'Something went wrong. Try again.' }, 500);
  }
};

function parseBody(bodyText) {
  try {
    const body = JSON.parse(bodyText || '{}');
    if (typeof body === 'object' && body !== null) return body;
  } catch {
    // Falls through to the error below.
  }
  throw new HttpError(400, 'invalid_json', 'Send the request as a JSON object.');
}

async function createRequest({ tablesDB, storage, tokens }, userId, body) {
  const input = validateRequest(body);

  const order = await getRowOrNull(tablesDB, TABLES.orders, input.orderId);
  if (!order) throw new HttpError(404, 'order_not_found', 'We could not find that order.');
  if (order.customerId !== userId) throw new HttpError(403, 'not_your_order', 'This order belongs to another account.');
  if (order.status !== 'delivered') throw new HttpError(409, 'not_delivered', 'This order has not been delivered yet.');

  const item = JSON.parse(order.items).find((line) => line.sku === input.itemSku);
  if (!item) throw new HttpError(404, 'item_not_found', 'That item is not part of this order.');

  const photo = input.photoId ? await lockPhoto({ storage, tokens }, userId, input.photoId) : null;

  try {
    const request = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.requests,
      rowId: ID.unique(),
      data: {
        orderId: order.$id,
        orderNumber: order.number,
        customerId: userId,
        customerName: order.customerName,
        itemSku: item.sku,
        itemName: item.name,
        amountCents: item.unitPriceCents * item.quantity,
        reason: input.reason,
        details: input.details,
        photoId: photo?.photoId ?? null,
        photoToken: photo?.photoToken ?? null,
        status: 'submitted',
      },
      // Read-only for the customer. The staff team reads every row through the
      // table permissions.
      permissions: [Permission.read(Role.user(userId))],
    });
    return { requestId: request.$id, number: requestNumber(request) };
  } catch (err) {
    // The unique index on (orderId, itemSku) allows one request per item.
    if (err.code === 409 && err.type === 'row_unique_constraint_violation') {
      const { rows } = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        queries: [Query.equal('orderId', [order.$id]), Query.equal('itemSku', [item.sku]), Query.limit(1)],
      });
      throw new HttpError(409, 'request_exists', 'You already asked for a refund for this item.', {
        requestId: rows[0]?.$id,
        number: rows[0] ? requestNumber(rows[0]) : undefined,
      });
    }
    throw err;
  }
}

async function createReply({ tablesDB, storage, tokens }, userId, requestId, body) {
  const input = validateReply(body);

  const request = isId(requestId) ? await getRowOrNull(tablesDB, TABLES.requests, requestId) : null;
  if (!request || request.customerId !== userId) {
    throw new HttpError(404, 'request_not_found', 'We could not find that request.');
  }
  if (request.status !== 'needs_customer') {
    throw new HttpError(409, 'not_waiting_for_reply', 'This request is not waiting for an answer.');
  }

  const photo = input.photoId ? await lockPhoto({ storage, tokens }, userId, input.photoId) : null;

  const reply = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.replies,
    rowId: ID.unique(),
    data: {
      requestId,
      customerId: userId,
      message: input.message,
      photoId: photo?.photoId ?? null,
      photoToken: photo?.photoToken ?? null,
    },
    permissions: [Permission.read(Role.user(userId))],
  });
  return { replyId: reply.$id };
}

/**
 * The customer uploaded the photo, so they hold read, update, and delete on it.
 * Replace that with read only, so the evidence stays, and create a file token
 * that the web app uses to show the photo.
 */
async function lockPhoto({ storage, tokens }, userId, fileId) {
  const owner = Permission.read(Role.user(userId));
  const file = await storage.getFile({ bucketId: BUCKET_ID, fileId }).catch((err) => {
    if (err.code === 404) return null;
    throw err;
  });
  if (!file || !file.$permissions.includes(owner)) {
    throw new HttpError(404, 'photo_not_found', 'Upload the photo again.');
  }

  await storage.updateFile({ bucketId: BUCKET_ID, fileId, permissions: [owner] });
  const token = await tokens.createFileToken({
    bucketId: BUCKET_ID,
    fileId,
    expire: new Date(Date.now() + PHOTO_TOKEN_DAYS * DAY_MS).toISOString(),
  });
  return { photoId: fileId, photoToken: token.secret };
}

async function getRowOrNull(tablesDB, tableId, rowId) {
  try {
    return await tablesDB.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}
