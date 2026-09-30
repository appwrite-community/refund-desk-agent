import { randomInt } from 'node:crypto';
import { Permission, Role } from 'node-appwrite';
import { DATABASE_ID, RETURN_ADDRESS, TABLES } from '../config.js';
import { DAY_MS, money, shortDate } from './format.js';

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = (length) => Array.from({ length }, () => BASE32[randomInt(BASE32.length)]).join('');

/**
 * Writes the refund to the payments ledger. The row ID is derived from the
 * request, so a second attempt (a retry, a duplicate event, or a second
 * approval) fails with 409 instead of paying twice.
 */
export async function issueRefund(ctx, request, order, amountCents) {
  const refundId = `refund_${request.$id}`;
  try {
    return await ctx.tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.payments,
      rowId: refundId,
      data: {
        kind: 'refund',
        orderId: order.$id,
        requestId: request.$id,
        customerId: request.customerId,
        amountCents,
        cardBrand: order.cardBrand,
        cardLast4: order.cardLast4,
        reference: `re_${randomCode(14)}`,
      },
      permissions: [Permission.read(Role.user(request.customerId))],
    });
  } catch (err) {
    if (err.code === 409 && err.type === 'row_already_exists') {
      ctx.log(`${refundId} already exists, so the refund was issued before.`);
      return ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.payments, rowId: refundId });
    }
    throw err;
  }
}

/** Refunds the request, marks it refunded, and tells the customer. */
export async function completeRefund(ctx, run, request, order, amountCents, { from = 'agent' } = {}) {
  const refund = await issueRefund(ctx, request, order, amountCents);
  await ctx.tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.requests,
    rowId: request.$id,
    data: { status: 'refunded', refundId: refund.$id, pendingApprovalId: null },
  });
  await run.action(`Issued refund ${money(refund.amountCents)}`, `Reference ${refund.reference}, ${refund.cardBrand} ending ${refund.cardLast4}.`);
  await run.tellCustomer(
    'Refund issued',
    `We refunded ${money(refund.amountCents)} to your ${refund.cardBrand} ending ${refund.cardLast4}. ` +
      'Refunds usually show up in 5 to 10 business days.',
    { from },
  );
  return refund;
}

/** The next whole minute at least `minutes` from now. Delayed executions need whole minutes. */
export function checkTime(minutes, now = Date.now()) {
  const minute = 60 * 1000;
  return new Date(Math.ceil((now + Math.max(minutes, 1) * minute) / minute) * minute);
}

/**
 * Queues a return check as a delayed execution of this same function. Nothing
 * runs in the meantime. The body tells the future execution what to do.
 */
export async function scheduleReturnCheck(ctx, request, attempt, at) {
  const execution = await ctx.functions.createExecution({
    functionId: process.env.APPWRITE_FUNCTION_ID,
    async: true,
    scheduledAt: at.toISOString(),
    body: JSON.stringify({ type: 'return_check', requestId: request.$id, attempt }),
  });
  return execution;
}

/** Sends a return code and schedules the first return check. */
export async function startReturn(ctx, run, request) {
  const returnCode = `RMA-${randomCode(6)}`;
  const checkAt = checkTime(ctx.config.returnCheckDelayMinutes);
  const shipBy = new Date(Date.now() + 7 * DAY_MS);

  // Update the request before queueing the check, so the check always finds it.
  await ctx.tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.requests,
    rowId: request.$id,
    data: {
      status: 'awaiting_return',
      pendingApprovalId: null,
      returnCode,
      returnStatus: 'awaiting',
      returnChecks: 0,
      returnCheckAt: checkAt.toISOString(),
    },
  });
  const execution = await scheduleReturnCheck(ctx, request, 1, checkAt);
  await run.action(`Scheduled a return check for ${shortDate(checkAt)}`, `Delayed execution ${execution.$id}.`);
  await run.tellCustomer(
    'Send the item back',
    `Ship the ${request.itemName} with return code ${returnCode} to ${RETURN_ADDRESS} by ${shortDate(shipBy)}. ` +
      `We check for it on ${shortDate(checkAt)} and refund ${money(request.amountCents)} once it arrives.`,
    { from: 'store' },
  );
  return { returnCode, checkAt };
}
