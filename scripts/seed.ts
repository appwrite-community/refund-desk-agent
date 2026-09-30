// Seeds demo users, the staff team, orders with their charges, the refund
// policy, and requests that were resolved before the demo starts. Safe to run
// again: people and resolved requests that exist are kept, orders and policies
// are updated in place.
import { join } from 'node:path';
import { Permission, Query, Role, Tokens } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { client, createIfMissing, describeError, storage, tablesDB, teams, users } from './lib/client.ts';
import { money, shortDate, stableCode, stableId } from './lib/format.ts';
import { BUCKET, DATABASE, STAFF_TEAM } from './schema.ts';
import {
  CATALOG,
  CUSTOMERS,
  DEMO_PASSWORD,
  HISTORY,
  ORDERS,
  POLICIES,
  STAFF,
  cardFor,
  orderId,
  type HistoryCase,
  type Order,
} from './seed-data.ts';

const databaseId = DATABASE.id;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const seededAt = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const readOnlyFor = (userId: string) => [Permission.read(Role.user(userId))];

/** A moment `days` ago at a fixed UTC hour, so seeded activity lands in office hours. */
function daysAgo(days: number, hour: number) {
  const date = new Date(seededAt - days * DAY);
  date.setUTCHours(hour, 0, 0, 0);
  return date.getTime();
}

const REASON_LABELS = {
  damaged: 'Arrived damaged',
  defective: 'Stopped working',
  wrong_item: 'Wrong item received',
  changed_mind: 'Changed my mind',
};

const POLICY_FOR_REASON = {
  damaged: 'damaged_in_transit',
  defective: 'defective',
  wrong_item: 'wrong_item',
  changed_mind: 'changed_mind',
} as const;

const RETURN_ADDRESS = 'Pourhaven Returns, 1200 Harbor Way, Unit 4, Oakland, CA 94607';

async function seedPeople() {
  for (const person of [...STAFF, ...CUSTOMERS]) {
    await createIfMissing(() =>
      users.create({ userId: person.id, email: person.email, password: DEMO_PASSWORD, name: person.name }),
    );
  }
  for (const member of STAFF) {
    const { memberships } = await teams.listMemberships({
      teamId: STAFF_TEAM.id,
      queries: [Query.equal('userId', [member.id])],
    });
    if (memberships.length === 0) {
      // Server-side memberships are confirmed right away, without an invite email.
      await teams.createMembership({ teamId: STAFF_TEAM.id, roles: member.roles, userId: member.id });
    }
  }
  console.log(`People: ${STAFF.length} staff, ${CUSTOMERS.length} customers`);
}

async function seedPolicies() {
  for (const [index, policy] of POLICIES.entries()) {
    await tablesDB.upsertRow({
      databaseId,
      tableId: 'policies',
      rowId: policy.id,
      data: { title: policy.title, body: policy.body, order: index + 1 },
    });
  }
  console.log(`Policies: ${POLICIES.length} sections`);
}

function orderRow(order: Order) {
  const customer = CUSTOMERS.find((person) => person.id === order.customerId)!;
  const items = order.items.map(({ sku, quantity }) => ({
    sku,
    name: CATALOG[sku].name,
    quantity,
    unitPriceCents: CATALOG[sku].priceCents,
  }));
  return {
    number: order.number,
    customerId: order.customerId,
    customerName: customer.name,
    placedAt: iso(daysAgo(order.placedDaysAgo, 9)),
    deliveredAt: iso(daysAgo(order.deliveredDaysAgo, 15)),
    status: 'delivered',
    items,
    totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
    ...cardFor(order),
  };
}

async function seedOrders() {
  for (const order of ORDERS) {
    const row = orderRow(order);
    await tablesDB.upsertRow({
      databaseId,
      tableId: 'orders',
      rowId: orderId(order),
      data: { ...row, items: JSON.stringify(row.items), $createdAt: row.placedAt },
      permissions: readOnlyFor(order.customerId),
    });
    await tablesDB.upsertRow({
      databaseId,
      tableId: 'payments',
      rowId: `charge_${orderId(order)}`,
      data: {
        kind: 'charge',
        orderId: orderId(order),
        requestId: null,
        customerId: order.customerId,
        amountCents: row.totalCents,
        cardBrand: row.cardBrand,
        cardLast4: row.cardLast4,
        reference: `ch_${stableCode(order.number, 14)}`,
        $createdAt: row.placedAt,
      },
      permissions: readOnlyFor(order.customerId),
    });
  }
  console.log(`Orders: ${ORDERS.length} with their charges`);
}

type Step = {
  at: number;
  runId: string;
  kind: 'trigger' | 'tool' | 'action' | 'message' | 'error' | 'finish';
  actor?: 'agent' | 'staff' | 'customer' | 'system';
  actorName?: string;
  title: string;
  detail?: string;
  tool?: string;
  durationMs?: number;
  visibility?: 'staff' | 'customer';
  rowId?: string;
};

/**
 * Writes one resolved request the way the agent and staff would have: the
 * request, its photo, the approval, the refund, and every timeline step.
 */
async function seedHistoryCase(item: HistoryCase) {
  const order = ORDERS.find((candidate) => candidate.number === item.order)!;
  const row = orderRow(order);
  const line = row.items.find((candidate) => candidate.sku === item.sku)!;
  const amountCents = line.unitPriceCents * line.quantity;
  const customer = CUSTOMERS.find((person) => person.id === order.customerId)!;
  const staff = STAFF.find((person) => person.id === item.review?.decidedBy);
  const card = `${row.cardBrand} ending ${row.cardLast4}`;
  const asked = daysAgo(item.askedDaysAgo, 11) + stableCode(item.id, 1).charCodeAt(0) * MINUTE;
  const decided = asked + (item.review?.hoursLater ?? 0) * HOUR;
  const firstCheck = decided + 7 * DAY;

  const photo = item.photo ? await uploadPhoto(item, customer.id) : null;
  const steps: Step[] = [];
  const run = (index: number) => stableId(`${item.id}-run-${index}`);
  const add = (step: Step) => steps.push(step);

  // Run 1: the agent investigates.
  const r1 = run(1);
  add({
    at: asked,
    runId: r1,
    kind: 'trigger',
    rowId: `req_${item.id}`,
    actor: 'customer',
    actorName: customer.name,
    title: 'Asked for a refund',
    detail: `${REASON_LABELS[item.reason]}. ${item.details}`,
    visibility: 'customer',
  });
  const deliveredDays = order.deliveredDaysAgo - item.askedDaysAgo;
  add({
    at: asked + 4_100,
    runId: r1,
    kind: 'tool',
    tool: 'get_order',
    title: `Looked up order ${order.number}`,
    detail: `Delivered ${deliveredDays} ${deliveredDays === 1 ? 'day' : 'days'} ago. ${row.items.length} ${row.items.length === 1 ? 'item' : 'items'}. Paid with ${card}.`,
    durationMs: 164,
  });
  add({
    at: asked + 5_900,
    runId: r1,
    kind: 'tool',
    tool: 'get_refund_history',
    title: 'Checked refund history',
    detail: historyDetail(item),
    durationMs: 211,
  });
  const policy = POLICIES.find((candidate) => candidate.id === POLICY_FOR_REASON[item.reason])!;
  add({
    at: asked + 7_800,
    runId: r1,
    kind: 'tool',
    tool: 'read_policy',
    title: `Read policy: ${policy.title}`,
    detail: policy.body,
    durationMs: 118,
  });
  if (item.inspection) {
    add({
      at: asked + 9_600,
      runId: r1,
      kind: 'tool',
      tool: 'inspect_photo',
      title: 'Inspected the photo',
      detail: item.inspection,
      durationMs: 3_420,
    });
  }

  let status: string;
  let refund: { at: number; amountCents: number } | null = null;
  let approvalId: string | null = null;
  let returnCode: string | null = null;

  if (item.outcome === 'auto_refund') {
    refund = { at: asked + 15_000, amountCents };
    add({ at: asked + 14_700, runId: r1, kind: 'tool', tool: 'issue_refund', title: 'All automatic refund rules passed', detail: 'The photo shows the damage, the item is under the limit, and it was delivered recently with no recent refunds.', durationMs: 612 });
    add({ at: asked + 15_000, runId: r1, kind: 'action', title: `Issued refund ${money(amountCents)}`, detail: `Reference re_${stableCode(`${item.id}-refund`, 14)}, ${card}.` });
    add({ at: asked + 15_300, runId: r1, kind: 'message', title: 'Refund issued', detail: refundMessage(amountCents, card), visibility: 'customer' });
    add({ at: asked + 15_500, runId: r1, kind: 'finish', title: 'Refunded' });
    status = 'refunded';
  } else {
    const review = item.review!;
    approvalId = `${item.id}-a`;
    add({
      at: asked + 14_900,
      runId: r1,
      kind: 'tool',
      tool: 'request_approval',
      title: `Sent to staff: ${recommendationText(review.recommendation, amountCents)}`,
      detail: review.reasoning,
      durationMs: 388,
    });
    add({ at: asked + 15_200, runId: r1, kind: 'message', title: 'A person is reviewing your request', detail: 'A member of our support team is reviewing your request and will reply within one business day.', visibility: 'customer' });
    add({ at: asked + 15_400, runId: r1, kind: 'finish', title: 'Waiting for staff' });

    // Run 2: the staff decision resumes the agent.
    const r2 = run(2);
    const decisionTitle = {
      approved: 'Approved the refund',
      approved_after_return: 'Approved the refund after a return',
      closed_no_return: 'Approved the refund after a return',
      declined: 'Declined the request',
    }[item.outcome];
    add({ at: decided, runId: r2, kind: 'trigger', rowId: `apr_${approvalId}`, actor: 'staff', actorName: staff!.name, title: decisionTitle, detail: review.staffNote });

    if (item.outcome === 'approved') {
      refund = { at: decided + 1_200, amountCents };
      add({ at: decided + 1_200, runId: r2, kind: 'action', title: `Issued refund ${money(amountCents)}`, detail: `Reference re_${stableCode(`${item.id}-refund`, 14)}, ${card}.` });
      add({ at: decided + 1_500, runId: r2, kind: 'message', actor: 'system', actorName: 'Pourhaven', title: 'Refund issued', detail: refundMessage(amountCents, card), visibility: 'customer' });
      add({ at: decided + 1_700, runId: r2, kind: 'finish', title: 'Refunded' });
      status = 'refunded';
    } else if (item.outcome === 'declined') {
      add({ at: decided + 1_100, runId: r2, kind: 'tool', tool: 'write_message', title: 'Wrote the message to the customer', durationMs: 1_840 });
      add({ at: decided + 3_100, runId: r2, kind: 'message', actor: 'system', actorName: 'Pourhaven', title: 'Request declined', detail: review.customerMessage, visibility: 'customer' });
      add({ at: decided + 3_300, runId: r2, kind: 'finish', title: 'Declined' });
      status = 'declined';
    } else {
      returnCode = `RMA-${stableCode(`${item.id}-rma`, 6)}`;
      add({ at: decided + 1_000, runId: r2, kind: 'action', title: `Scheduled a return check for ${shortDate(firstCheck)}`, detail: `Delayed execution ${stableId(`${item.id}-check-1`)}.` });
      add({
        at: decided + 1_300,
        runId: r2,
        kind: 'message',
        actor: 'system',
        actorName: 'Pourhaven',
        title: 'Send the item back',
        detail: `Ship the ${line.name} with return code ${returnCode} to ${RETURN_ADDRESS} by ${shortDate(decided + 7 * DAY)}. We check for it on ${shortDate(firstCheck)} and refund ${money(amountCents)} once it arrives.`,
        visibility: 'customer',
      });
      add({ at: decided + 1_500, runId: r2, kind: 'finish', title: 'Waiting for the return' });

      // Run 3 (and 4): delayed executions check for the return.
      const r3 = run(3);
      if (item.outcome === 'approved_after_return') {
        add({ at: firstCheck, runId: r3, kind: 'trigger', rowId: `chk_${item.id}_1`, actor: 'system', actorName: 'Return check', title: 'Checked for the return (check 1 of 2)', detail: 'The item arrived.' });
        refund = { at: firstCheck + 900, amountCents };
        add({ at: firstCheck + 900, runId: r3, kind: 'action', title: `Issued refund ${money(amountCents)}`, detail: `Reference re_${stableCode(`${item.id}-refund`, 14)}, ${card}.` });
        add({ at: firstCheck + 1_200, runId: r3, kind: 'message', actor: 'system', actorName: 'Pourhaven', title: 'Refund issued', detail: refundMessage(amountCents, card), visibility: 'customer' });
        add({ at: firstCheck + 1_400, runId: r3, kind: 'finish', title: 'Refunded' });
        status = 'refunded';
      } else {
        const secondCheck = firstCheck + 7 * DAY;
        add({ at: firstCheck, runId: r3, kind: 'trigger', rowId: `chk_${item.id}_1`, actor: 'system', actorName: 'Return check', title: 'Checked for the return (check 1 of 2)', detail: 'The item has not arrived.' });
        add({ at: firstCheck + 800, runId: r3, kind: 'action', title: `Scheduled another return check for ${shortDate(secondCheck)}`, detail: `Delayed execution ${stableId(`${item.id}-check-2`)}.` });
        add({ at: firstCheck + 1_100, runId: r3, kind: 'message', title: 'Reminder: send the item back', detail: `We have not received the ${line.name} yet. Ship it with return code ${returnCode} to ${RETURN_ADDRESS}. We check again on ${shortDate(secondCheck)}.`, visibility: 'customer' });
        add({ at: firstCheck + 1_300, runId: r3, kind: 'finish', title: 'Waiting for the return' });
        const r4 = run(4);
        add({ at: secondCheck, runId: r4, kind: 'trigger', rowId: `chk_${item.id}_2`, actor: 'system', actorName: 'Return check', title: 'Checked for the return (check 2 of 2)', detail: 'The item has not arrived.' });
        add({ at: secondCheck + 700, runId: r4, kind: 'message', title: 'Request closed', detail: `We did not receive the ${line.name}, so this request is closed.`, visibility: 'customer' });
        add({ at: secondCheck + 900, runId: r4, kind: 'finish', title: 'Closed' });
        status = 'closed';
      }
    }
  }

  const lastStepAt = Math.max(...steps.map((step) => step.at));
  await tablesDB.createRow({
    databaseId,
    tableId: 'refund_requests',
    rowId: item.id,
    data: {
      orderId: orderId(order),
      orderNumber: order.number,
      customerId: customer.id,
      customerName: customer.name,
      itemSku: item.sku,
      itemName: line.name,
      amountCents,
      reason: item.reason,
      details: item.details,
      photoId: photo?.fileId ?? null,
      photoToken: photo?.token ?? null,
      status,
      refundId: refund ? `refund_${item.id}` : null,
      returnCode,
      returnStatus: returnCode ? (status === 'refunded' ? 'received' : 'awaiting') : null,
      returnReceivedAt: returnCode && status === 'refunded' ? iso(firstCheck - 2 * DAY) : null,
      returnChecks: item.outcome === 'closed_no_return' ? 2 : item.outcome === 'approved_after_return' ? 1 : 0,
      $createdAt: iso(asked),
      $updatedAt: iso(lastStepAt),
    },
    permissions: readOnlyFor(customer.id),
  });

  if (approvalId && item.review) {
    await tablesDB.createRow({
      databaseId,
      tableId: 'approvals',
      rowId: approvalId,
      data: {
        requestId: item.id,
        recommendation: item.review.recommendation,
        amountCents,
        findings: item.review.findings,
        concerns: item.review.concerns,
        reasoning: item.review.reasoning,
        draftQuestion: null,
        requireReturn: item.review.recommendation === 'refund_after_return',
        decision: item.outcome === 'declined' ? 'decline' : 'approve',
        staffNote: item.review.staffNote ?? null,
        decidedBy: staff!.id,
        decidedByName: staff!.name,
        decidedAt: iso(decided),
        $createdAt: iso(asked + 14_900),
        $updatedAt: iso(decided),
      },
    });
  }

  if (refund) {
    await tablesDB.createRow({
      databaseId,
      tableId: 'payments',
      rowId: `refund_${item.id}`,
      data: {
        kind: 'refund',
        orderId: orderId(order),
        requestId: item.id,
        customerId: customer.id,
        amountCents: refund.amountCents,
        cardBrand: row.cardBrand,
        cardLast4: row.cardLast4,
        reference: `re_${stableCode(`${item.id}-refund`, 14)}`,
        $createdAt: iso(refund.at),
      },
      permissions: readOnlyFor(customer.id),
    });
  }

  for (const [index, step] of steps.entries()) {
    const visibility = step.visibility ?? 'staff';
    await tablesDB.createRow({
      databaseId,
      tableId: 'run_steps',
      rowId: step.rowId ?? `${item.id}-${String(index + 1).padStart(2, '0')}`,
      data: {
        requestId: item.id,
        runId: step.runId,
        kind: step.kind,
        actor: step.actor ?? 'agent',
        actorName: step.actorName ?? 'Refund agent',
        title: step.title,
        detail: step.detail ?? null,
        tool: step.tool ?? null,
        status: 'succeeded',
        durationMs: step.durationMs ?? null,
        visibility,
        $createdAt: iso(step.at),
        $updatedAt: iso(step.at + (step.durationMs ?? 0)),
      },
      permissions: visibility === 'customer' ? readOnlyFor(customer.id) : [],
    });
  }
}

/** Days ago the refund of a resolved request was paid, or null when it was not refunded. */
function refundDaysAgo(item: HistoryCase) {
  if (item.outcome === 'declined' || item.outcome === 'closed_no_return') return null;
  return item.askedDaysAgo - (item.outcome === 'approved_after_return' ? 7 : 0);
}

/** What get_refund_history reported when the request came in. */
function historyDetail(item: HistoryCase) {
  const customerOf = (history: HistoryCase) => ORDERS.find((order) => order.number === history.order)!.customerId;
  const earlierRefunds = HISTORY.filter((other) => customerOf(other) === customerOf(item))
    .map(refundDaysAgo)
    .filter((days): days is number => days !== null && days > item.askedDaysAgo)
    .map((days) => days - item.askedDaysAgo);
  const within = (days: number) => earlierRefunds.filter((age) => age <= days).length;
  if (within(365) === 0) return 'No refunds in the last 12 months.';
  const recent = within(90);
  return `${recent} ${recent === 1 ? 'refund' : 'refunds'} in the last 90 days, ${within(365)} in the last 12 months.`;
}

function recommendationText(recommendation: string, amountCents: number) {
  if (recommendation === 'refund') return `recommends a refund of ${money(amountCents)}`;
  if (recommendation === 'refund_after_return') return `recommends a refund of ${money(amountCents)} after a return`;
  return 'recommends declining';
}

const refundMessage = (amountCents: number, card: string) =>
  `We refunded ${money(amountCents)} to your ${card}. Refunds usually show up in 5 to 10 business days.`;

/** Uploads a sample photo for a resolved request, readable only by its customer. */
async function uploadPhoto(item: HistoryCase, customerId: string) {
  const fileId = item.id;
  await createIfMissing(() =>
    storage.createFile({
      bucketId: BUCKET.bucketId,
      fileId,
      file: InputFile.fromPath(join(import.meta.dirname, 'photos', 'history', `${item.photo}.jpg`), `${item.photo}.jpg`),
      permissions: readOnlyFor(customerId),
    }),
  );
  const token = await new Tokens(client).createFileToken({
    bucketId: BUCKET.bucketId,
    fileId,
    expire: iso(Date.now() + 180 * DAY),
  });
  return { fileId, token: token.secret };
}

async function seedHistory() {
  let created = 0;
  for (const item of HISTORY) {
    // Resolved requests are written once. Rewriting them would fire update events.
    const exists = await tablesDB
      .getRow({ databaseId, tableId: 'refund_requests', rowId: item.id })
      .then(() => true)
      .catch(() => false);
    if (exists) continue;
    await seedHistoryCase(item);
    created++;
  }
  console.log(`Resolved requests: ${created} created, ${HISTORY.length - created} already there`);
}

try {
  await seedPeople();
  await seedPolicies();
  await seedOrders();
  await seedHistory();
  console.log(`Done. Sign in as a staff member (${STAFF[0]!.email}) or a customer (${CUSTOMERS[0]!.email}), password ${DEMO_PASSWORD}.`);
} catch (err) {
  console.error(`Seeding failed: ${describeError(err)}`);
  process.exitCode = 1;
}
