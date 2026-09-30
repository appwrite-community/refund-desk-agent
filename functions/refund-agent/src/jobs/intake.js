import { TABLES } from '../config.js';
import { investigate } from '../lib/agent.js';
import { findRow } from '../lib/context.js';
import { REASON_LABELS } from '../lib/format.js';
import { runOnce } from '../lib/timeline.js';

/** A new refund request: the agent investigates, then refunds it or hands it to staff. */
export async function intakeJob(ctx, { rowId }) {
  const request = await findRow(ctx, TABLES.requests, rowId);
  if (request?.status !== 'submitted') {
    ctx.log(`Request ${rowId} is ${request?.status ?? 'missing'}, not new. Nothing to do.`);
    return;
  }

  const trigger = {
    claimId: `req_${request.$id}`,
    actor: 'customer',
    actorName: request.customerName,
    title: 'Asked for a refund',
    detail: `${REASON_LABELS[request.reason]}. ${request.details}`,
    visibility: 'customer',
  };
  await runOnce(ctx, request, trigger, async (run) => {
    const outcome = await investigate(ctx, run, request, { job: 'intake' });
    await run.finish(outcome.status === 'refunded' ? 'Refunded' : 'Waiting for staff');
    ctx.log(`Request ${request.$id}: ${outcome.status}`);
  });
}
