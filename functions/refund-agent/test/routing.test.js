import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeExecution } from '../src/lib/routing.js';

const event = (name) => ({ 'x-appwrite-trigger': 'event', 'x-appwrite-event': name });

test('row events map to jobs', () => {
  assert.deepEqual(routeExecution(event('tablesdb.refund_desk.tables.refund_requests.rows.r1.create')), {
    job: 'intake',
    rowId: 'r1',
  });
  assert.deepEqual(routeExecution(event('tablesdb.refund_desk.tables.approvals.rows.a1.update')), {
    job: 'decision',
    rowId: 'a1',
  });
  assert.deepEqual(routeExecution(event('tablesdb.refund_desk.tables.replies.rows.p1.create')), {
    job: 'reply',
    rowId: 'p1',
  });
});

test('events the agent causes itself start nothing', () => {
  for (const name of [
    'tablesdb.refund_desk.tables.refund_requests.rows.r1.update',
    'tablesdb.refund_desk.tables.approvals.rows.a1.create',
    'tablesdb.refund_desk.tables.run_steps.rows.s1.create',
    'tablesdb.refund_desk.tables.payments.rows.refund_r1.create',
    'databases.refund_desk.collections.approvals.documents.a1.update',
    '',
  ]) {
    assert.equal(routeExecution(event(name)), null, name);
  }
});

test('delayed executions carry a return check', () => {
  const headers = { 'x-appwrite-trigger': 'schedule' };
  assert.deepEqual(routeExecution(headers, JSON.stringify({ type: 'return_check', requestId: 'r1', attempt: 2 })), {
    job: 'return_check',
    requestId: 'r1',
    attempt: 2,
  });
  assert.equal(routeExecution(headers, ''), null);
  assert.equal(routeExecution(headers, 'not json'), null);
  assert.equal(routeExecution(headers, JSON.stringify({ type: 'return_check', requestId: 'r1', attempt: '1' })), null);
});

test('direct HTTP calls start nothing', () => {
  assert.equal(routeExecution({ 'x-appwrite-trigger': 'http' }, '{"type":"return_check","requestId":"r1","attempt":1}'), null);
});
