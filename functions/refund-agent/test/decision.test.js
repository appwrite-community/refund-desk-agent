import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decisionJob } from '../src/jobs/decision.js';
import { fakeFunctions, fakeModel, fakeTablesDB, fakeTeams } from './fakes.js';

process.env.APPWRITE_FUNCTION_ID = 'refund-agent';

function setup({ approval = {}, userId = 'maya-okafor', functions = fakeFunctions(), openai = fakeModel({ message: 'Sorry.' }) } = {}) {
  const tablesDB = fakeTablesDB({
    refund_requests: [
      {
        $id: 'req1',
        $sequence: '42',
        customerId: 'cust1',
        customerName: 'Priya Raman',
        orderId: 'ph-1',
        itemSku: 'KTL-09',
        itemName: 'Gooseneck kettle, 0.9 L',
        amountCents: 12900,
        reason: 'damaged',
        details: 'The spout arrived bent.',
        status: 'needs_approval',
        pendingApprovalId: 'apr1',
      },
    ],
    approvals: [
      {
        $id: 'apr1',
        requestId: 'req1',
        recommendation: 'refund',
        amountCents: 12900,
        requireReturn: false,
        decision: 'approve',
        staffNote: null,
        decidedByName: 'Maya Okafor',
        ...approval,
      },
    ],
    orders: [{ $id: 'ph-1', cardBrand: 'Visa', cardLast4: '4242' }],
  });
  const ctx = {
    executionId: 'exec2',
    userId,
    config: { model: 'test', returnCheckDelayMinutes: 7 * 24 * 60 },
    log: () => {},
    error: () => {},
    tablesDB,
    teams: fakeTeams({ 'maya-okafor': 'Maya Okafor' }),
    functions,
    openai,
  };
  const request = () => tablesDB.row('refund_requests', 'req1');
  const steps = () => tablesDB.rows('run_steps');
  return { ctx, tablesDB, functions, request, steps };
}

test('an approval refunds the item, never more than it cost', async () => {
  const { ctx, tablesDB, request, steps } = setup({ approval: { amountCents: 99900 } });
  await decisionJob(ctx, { rowId: 'apr1' });
  const payments = tablesDB.rows('payments');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].$id, 'refund_req1');
  assert.equal(payments[0].amountCents, 12900);
  assert.equal(request().status, 'refunded');
  assert.equal(request().pendingApprovalId, null);
  const trigger = tablesDB.row('run_steps', 'apr_apr1');
  assert.equal(trigger.actorName, 'Maya Okafor');
  assert.ok(steps().some((step) => step.title === 'Refund issued' && step.actorName === 'Pourhaven' && step.visibility === 'customer'));
  assert.equal(tablesDB.updatedTables.includes('approvals'), false);
});

test('an approval with a return queues a check and sends a return code', async () => {
  const { ctx, tablesDB, functions, request, steps } = setup({ approval: { requireReturn: true } });
  await decisionJob(ctx, { rowId: 'apr1' });
  assert.equal(functions.executions.length, 1);
  const [execution] = functions.executions;
  assert.equal(execution.functionId, 'refund-agent');
  assert.equal(execution.async, true);
  assert.deepEqual(JSON.parse(execution.body), { type: 'return_check', requestId: 'req1', attempt: 1 });
  const scheduledAt = new Date(execution.scheduledAt);
  assert.equal(scheduledAt.getUTCSeconds(), 0);
  assert.ok(scheduledAt.getTime() - Date.now() >= 7 * 24 * 60 * 60 * 1000);
  assert.equal(request().status, 'awaiting_return');
  assert.match(request().returnCode, /^RMA-[A-Z2-9]{6}$/);
  assert.equal(request().returnCheckAt, execution.scheduledAt);
  assert.equal(tablesDB.rows('payments').length, 0);
  assert.ok(steps().some((step) => step.title === 'Send the item back' && step.detail.includes(request().returnCode)));
});

test('when the check cannot be queued, the request goes back to staff', async () => {
  const { ctx, tablesDB, request, steps } = setup({ approval: { requireReturn: true }, functions: fakeFunctions({ fail: true }) });
  await decisionJob(ctx, { rowId: 'apr1' });
  assert.equal(request().status, 'needs_approval');
  assert.notEqual(request().pendingApprovalId, 'apr1');
  assert.equal(request().returnCode, undefined);
  const handOff = tablesDB.row('approvals', request().pendingApprovalId);
  assert.equal(handOff.recommendation, 'manual_review');
  assert.ok(steps().some((step) => step.kind === 'error' && step.status === 'failed'));
  assert.equal(tablesDB.updatedTables.includes('approvals'), false);
});

test('a decision from outside the staff team goes back to the queue', async () => {
  const { ctx, tablesDB, request, steps } = setup({ userId: 'console-user' });
  await decisionJob(ctx, { rowId: 'apr1' });
  await decisionJob(ctx, { rowId: 'apr1' });
  assert.equal(tablesDB.rows('payments').length, 0);
  assert.equal(request().status, 'needs_approval');
  const reopened = tablesDB.row('approvals', request().pendingApprovalId);
  assert.notEqual(reopened.$id, 'apr1');
  assert.equal(reopened.recommendation, 'refund');
  assert.equal(reopened.decision, undefined);
  assert.equal(tablesDB.rows('approvals').length, 2);
  assert.equal(tablesDB.row('run_steps', 'apr_apr1').title, 'Ignored a decision from outside the staff team');
  assert.deepEqual(steps().map((step) => step.kind), ['trigger', 'finish']);
  assert.equal(tablesDB.updatedTables.includes('approvals'), false);
});

test('each decision runs once', async () => {
  const { ctx, tablesDB, steps } = setup();
  await Promise.all([decisionJob(ctx, { rowId: 'apr1' }), decisionJob(ctx, { rowId: 'apr1' })]);
  await decisionJob(ctx, { rowId: 'apr1' });
  assert.equal(tablesDB.rows('payments').length, 1);
  assert.equal(steps().filter((step) => step.kind === 'trigger').length, 1);
});

test('asking the customer stores the question and tells the customer', async () => {
  const { ctx, request, steps } = setup({ approval: { decision: 'ask_customer', staffNote: 'Did new batteries help?' } });
  await decisionJob(ctx, { rowId: 'apr1' });
  assert.equal(request().status, 'needs_customer');
  assert.equal(request().question, 'Did new batteries help?');
  assert.ok(steps().some((step) => step.title === 'Question from Pourhaven' && step.visibility === 'customer'));
});

test('a decline falls back to a template when the model fails', async () => {
  const { ctx, request, steps } = setup({
    approval: { decision: 'decline', staffNote: 'The 30-day window has passed.' },
    openai: fakeModel(new Error('Request timed out.')),
  });
  await decisionJob(ctx, { rowId: 'apr1' });
  assert.equal(request().status, 'declined');
  const message = steps().find((step) => step.title === 'Request declined');
  assert.equal(
    message.detail,
    'We reviewed your request for the Gooseneck kettle, 0.9 L and cannot offer a refund. The 30-day window has passed.',
  );
});
