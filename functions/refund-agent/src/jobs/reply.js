import { Query } from 'node-appwrite';
import { DATABASE_ID, TABLES } from '../config.js';
import { investigate } from '../lib/agent.js';
import { findRow } from '../lib/context.js';
import { runOnce } from '../lib/timeline.js';

/**
 * The customer answered a question. The agent reviews the case again with the
 * answer and hands it back to staff. After a person is involved, only a person
 * decides, so this run cannot refund.
 */
export async function replyJob(ctx, { rowId }) {
  const reply = await findRow(ctx, TABLES.replies, rowId);
  const request = reply && (await findRow(ctx, TABLES.requests, reply.requestId));
  if (request?.status !== 'needs_customer') {
    ctx.log(`Reply ${rowId}: the request is not waiting for an answer. Nothing to do.`);
    return;
  }

  // The approval where staff chose to ask. Claiming it (not the reply) means two
  // quick answers to the same question start one review, not two.
  const { rows } = await ctx.tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.approvals,
    queries: [Query.equal('requestId', [request.$id]), Query.orderDesc('$createdAt'), Query.limit(1)],
  });
  const question = rows[0];
  if (question?.decision !== 'ask_customer') {
    ctx.log(`Reply ${rowId}: no question is open on request ${request.$id}. Nothing to do.`);
    return;
  }

  const trigger = {
    claimId: `rep_${question.$id}`,
    actor: 'customer',
    actorName: request.customerName,
    title: 'Answered the question',
    detail: reply.message,
    visibility: 'customer',
  };
  await runOnce(ctx, request, trigger, async (run) => {
    // Read the answers after the claim, so every answer sent so far is included.
    const replies = await ctx.tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.replies,
      queries: [Query.equal('requestId', [request.$id]), Query.orderAsc('$createdAt'), Query.limit(20)],
    });
    const outcome = await investigate(ctx, run, request, { job: 'reply', previousApproval: question, replies: replies.rows });
    await run.finish('Waiting for staff');
    ctx.log(`Request ${request.$id}: ${outcome.status}`);
  });
}
