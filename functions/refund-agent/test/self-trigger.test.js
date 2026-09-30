import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { routeExecution } from '../src/lib/routing.js';

// The agent runs on row events. Appwrite does not stop a function from
// triggering itself through its own writes, so the agent must never cause an
// event it listens to: it never creates refund_requests or replies rows and
// never updates approvals rows.

const sourceDir = join(import.meta.dirname, '..', 'src');
const files = readdirSync(sourceDir, { recursive: true }).filter((file) => file.endsWith('.js'));
const writes = files.flatMap((file) => {
  const source = readFileSync(join(sourceDir, file), 'utf8');
  const calls = source.matchAll(
    /\.(createRow|updateRow|upsertRow|incrementRowColumn|decrementRowColumn|deleteRow)\(\{[^}]*?tableId:\s*([\w.]+)/g,
  );
  return [...calls].map(([, method, table]) => ({ file, method, table }));
});

test('the source scan finds the agent writes', () => {
  assert.ok(writes.length >= 10, `found only ${writes.length} writes`);
  assert.ok(writes.some((write) => write.method === 'createRow' && write.table === 'TABLES.approvals'));
});

test('the agent never updates approvals rows', () => {
  const offending = writes.filter((write) => write.table === 'TABLES.approvals' && write.method !== 'createRow');
  assert.deepEqual(offending, []);
});

test('the agent never creates refund requests or replies', () => {
  const offending = writes.filter(
    (write) =>
      ['TABLES.requests', 'TABLES.replies'].includes(write.table) && ['createRow', 'upsertRow'].includes(write.method),
  );
  assert.deepEqual(offending, []);
});

test('the events the agent writes do not route to a job', () => {
  const caused = {
    createRow: 'create',
    updateRow: 'update',
    upsertRow: 'update',
    incrementRowColumn: 'update',
    decrementRowColumn: 'update',
  };
  const tableIds = {
    'TABLES.requests': 'refund_requests',
    'TABLES.steps': 'run_steps',
    'TABLES.payments': 'payments',
    'TABLES.approvals': 'approvals',
  };
  for (const write of writes) {
    const event = `tablesdb.refund_desk.tables.${tableIds[write.table]}.rows.x.${caused[write.method]}`;
    const route = routeExecution({ 'x-appwrite-trigger': 'event', 'x-appwrite-event': event });
    assert.equal(route, null, `${write.method} on ${write.table} in ${write.file} would start the agent`);
  }
});
