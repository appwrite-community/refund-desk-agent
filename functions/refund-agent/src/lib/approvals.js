import { ID } from 'node-appwrite';
import { DATABASE_ID, TABLES } from '../config.js';
import { truncate } from './format.js';

const MAX_POINTS = 5;

const clean = (points = []) => [...new Set(points.map((point) => point.trim()).filter(Boolean))].map((point) => truncate(point, 240));

/**
 * Hands the request to staff. The agent only ever creates approvals rows. Staff
 * update them, and that update event starts the next execution. If the agent
 * updated approvals too, its own writes would trigger it again.
 */
export async function requestApproval(ctx, run, request, proposal) {
  const approvalId = await createApproval(ctx, request, proposal);
  await run.tellCustomer(
    'A person is reviewing your request',
    'A member of our support team is reviewing your request and will reply within one business day.',
  );
  return approvalId;
}

/** Puts the same recommendation back in front of staff, as a new approvals row. */
export function reopenApproval(ctx, request, approval) {
  return createApproval(ctx, request, approval);
}

async function createApproval(ctx, request, proposal) {
  const approvalId = ID.unique();

  // The request moves first, so a fast decision always finds it waiting for this approval.
  await ctx.tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.requests,
    rowId: request.$id,
    data: { status: 'needs_approval', pendingApprovalId: approvalId },
  });
  await ctx.tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.approvals,
    rowId: approvalId,
    data: {
      requestId: request.$id,
      recommendation: proposal.recommendation,
      amountCents: request.amountCents,
      findings: clean(proposal.findings).slice(0, MAX_POINTS),
      concerns: clean(proposal.concerns).slice(0, MAX_POINTS),
      reasoning: truncate(proposal.reasoning, 2000),
      draftQuestion: proposal.draftQuestion ? truncate(proposal.draftQuestion, 500) : null,
      requireReturn: proposal.recommendation === 'refund_after_return',
    },
  });
  return approvalId;
}

/** Sends the request to staff without a recommendation, for example after an error. */
export async function escalate(ctx, run, request, reason) {
  return requestApproval(ctx, run, request, {
    recommendation: 'manual_review',
    findings: [],
    concerns: [reason],
    reasoning: `The agent stopped before a recommendation. ${reason}`,
    draftQuestion: null,
  });
}
