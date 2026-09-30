import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestApproval } from '../src/lib/approvals.js';
import { runOnce } from '../src/lib/timeline.js';
import { fakeTablesDB } from './fakes.js';

function setup() {
  const tablesDB = fakeTablesDB({
    refund_requests: [{ $id: 'req1', $sequence: '42', customerId: 'cust1', amountCents: 12900, status: 'submitted' }],
  });
  const ctx = { executionId: 'exec1', log: () => {}, error: () => {}, tablesDB };
  const trigger = { claimId: 'req_req1', actor: 'customer', actorName: 'Priya Raman', title: 'Asked for a refund', visibility: 'customer' };
  const request = () => tablesDB.row('refund_requests', 'req1');
  return { ctx, tablesDB, trigger, request };
}

/** Makes the next matching call throw once, like a failed network request. */
function failOnce(tablesDB, method, matches) {
  const original = tablesDB[method];
  let failed = false;
  tablesDB[method] = async (params) => {
    if (!failed && matches(params)) {
      failed = true;
      throw Object.assign(new Error('Server error'), { code: 500, type: 'general_server_error' });
    }
    return original(params);
  };
}

test('a request whose status update fails still reaches staff', async () => {
  const { ctx, tablesDB, trigger, request } = setup();
  failOnce(tablesDB, 'updateRow', ({ data }) => data.status === 'working');

  await runOnce(ctx, request(), trigger, async () => assert.fail('The work must not start.'));

  assert.equal(request().status, 'needs_approval');
  const approvals = tablesDB.rows('approvals');
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].recommendation, 'manual_review');
  assert.equal(request().pendingApprovalId, approvals[0].$id);
});

test('a failed approval insert is retried as a manual review', async () => {
  const { ctx, tablesDB, trigger, request } = setup();
  failOnce(tablesDB, 'createRow', ({ tableId }) => tableId === 'approvals');

  await runOnce(ctx, request(), trigger, (run) =>
    requestApproval(ctx, run, request(), { recommendation: 'refund', findings: ['Photo shows a dent.'], concerns: [], reasoning: 'Refund it.', draftQuestion: null }),
  );

  assert.equal(request().status, 'needs_approval');
  const approvals = tablesDB.rows('approvals');
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].recommendation, 'manual_review');
  assert.equal(request().pendingApprovalId, approvals[0].$id);
});
