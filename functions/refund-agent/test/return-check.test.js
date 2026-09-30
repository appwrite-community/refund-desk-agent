import assert from 'node:assert/strict';
import { test } from 'node:test';
import { returnCheckJob } from '../src/jobs/return-check.js';
import { fakeFunctions, fakeTablesDB } from './fakes.js';

process.env.APPWRITE_FUNCTION_ID = 'refund-agent';

function setup({ request = {}, functions = fakeFunctions() } = {}) {
  const tablesDB = fakeTablesDB({
    refund_requests: [
      {
        $id: 'req1',
        customerId: 'cust1',
        customerName: 'Aiko Tanaka',
        orderId: 'ph-1',
        itemName: 'Conical burr grinder',
        amountCents: 24900,
        status: 'awaiting_return',
        returnCode: 'RMA-ABC234',
        returnStatus: 'awaiting',
        returnChecks: 0,
        ...request,
      },
    ],
    orders: [{ $id: 'ph-1', cardBrand: 'Mastercard', cardLast4: '4444' }],
  });
  const ctx = {
    executionId: 'exec3',
    userId: null,
    config: { returnCheckDelayMinutes: 7 * 24 * 60 },
    log: () => {},
    error: () => {},
    tablesDB,
    functions,
  };
  const current = () => tablesDB.row('refund_requests', 'req1');
  const titles = () => tablesDB.rows('run_steps').map((step) => step.title);
  return { ctx, tablesDB, functions, current, titles };
}

test('a return that arrived is refunded', async () => {
  const { ctx, tablesDB, current } = setup({ request: { returnStatus: 'received' } });
  await returnCheckJob(ctx, { requestId: 'req1', attempt: 1 });
  assert.equal(current().status, 'refunded');
  assert.equal(tablesDB.row('payments', 'refund_req1').amountCents, 24900);
  assert.equal(tablesDB.row('run_steps', 'chk_req1_1').detail, 'The item arrived.');
});

test('a missing return gets one reminder and a second check', async () => {
  const { ctx, tablesDB, functions, current, titles } = setup();
  await returnCheckJob(ctx, { requestId: 'req1', attempt: 1 });
  assert.equal(current().status, 'awaiting_return');
  assert.equal(current().returnChecks, 1);
  assert.deepEqual(JSON.parse(functions.executions[0].body), { type: 'return_check', requestId: 'req1', attempt: 2 });
  assert.equal(current().returnCheckAt, functions.executions[0].scheduledAt);
  const reminder = tablesDB.rows('run_steps').find((step) => step.title === 'Reminder: send the item back');
  assert.equal(reminder.actorName, 'Pourhaven');
  assert.equal(reminder.visibility, 'customer');
  assert.ok(titles().includes('Waiting for the return'));
  assert.equal(tablesDB.rows('payments').length, 0);
});

test('the second miss closes the request', async () => {
  const { ctx, tablesDB, functions, current } = setup({ request: { returnChecks: 1 } });
  await returnCheckJob(ctx, { requestId: 'req1', attempt: 2 });
  assert.equal(current().status, 'closed');
  assert.equal(current().returnChecks, 2);
  assert.equal(functions.executions.length, 0);
  assert.equal(tablesDB.rows('payments').length, 0);
});

test('a check that is not due does nothing', async () => {
  const { ctx, tablesDB, current } = setup();
  await returnCheckJob(ctx, { requestId: 'req1', attempt: 2 });
  await returnCheckJob(ctx, { requestId: 'missing', attempt: 1 });
  assert.equal(current().status, 'awaiting_return');
  assert.equal(tablesDB.rows('run_steps').length, 0);
});

test('when the second check cannot be queued, the request goes to staff', async () => {
  const { ctx, tablesDB, current } = setup({ functions: fakeFunctions({ fail: true }) });
  await returnCheckJob(ctx, { requestId: 'req1', attempt: 1 });
  assert.equal(current().status, 'needs_approval');
  assert.equal(current().returnChecks, 0);
  assert.equal(tablesDB.row('approvals', current().pendingApprovalId).recommendation, 'manual_review');
});
