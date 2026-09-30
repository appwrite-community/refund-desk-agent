import { Query } from 'node-appwrite';
import { AGENT_NAME, DATABASE_ID, STAFF_TEAM_ID, TABLES } from '../config.js';
import { reopenApproval } from '../lib/approvals.js';
import { findRow } from '../lib/context.js';
import { REASON_LABELS, describeError, truncate } from '../lib/format.js';
import { structuredOutput } from '../lib/model.js';
import { completeRefund, startReturn } from '../lib/refunds.js';
import { runOnce } from '../lib/timeline.js';
import { DECLINE_PROMPT, DECLINE_SCHEMA, quoteCustomer } from '../prompts.js';

const TRIGGER_TITLES = {
  approve: 'Approved the refund',
  approve_after_return: 'Approved the refund after a return',
  ask_customer: 'Asked the customer a question',
  decline: 'Declined the request',
};

const FINISH_TITLES = {
  refunded: 'Refunded',
  awaiting_return: 'Waiting for the return',
  needs_customer: 'Waiting for the customer',
  declined: 'Declined',
};

/**
 * A staff member decided on an approval. This execution started from the
 * approvals row update, hours after the run that created it. Everything it
 * needs comes from TablesDB. Code carries out the decision; the model only
 * writes the decline message.
 */
export async function decisionJob(ctx, { rowId }) {
  const approval = await findRow(ctx, TABLES.approvals, rowId);
  if (!approval?.decision) {
    ctx.log(`Approval ${rowId} has no decision yet. Nothing to do.`);
    return;
  }
  const request = await findRow(ctx, TABLES.requests, approval.requestId);
  if (request?.status !== 'needs_approval' || request.pendingApprovalId !== approval.$id) {
    ctx.log(`Request ${approval.requestId} is not waiting for approval ${approval.$id}. Nothing to do.`);
    return;
  }

  const staff = await identifyStaff(ctx, approval);
  if (!staff) {
    // Only staff decide. A change from anyone else, for example an edit in the
    // Appwrite Console, puts the same recommendation back in the queue.
    const ignored = {
      claimId: `apr_${approval.$id}`,
      actor: 'agent',
      actorName: AGENT_NAME,
      title: 'Ignored a decision from outside the staff team',
      detail: 'Only members of the staff team can decide. The recommendation is back in the approval queue.',
      visibility: 'staff',
    };
    await runOnce(ctx, request, ignored, async (run) => {
      await reopenApproval(ctx, request, approval);
      await run.finish('Waiting for staff');
      ctx.log(`Request ${request.$id}: ignored a decision on ${approval.$id} from outside the staff team`);
    });
    return;
  }

  const kind = approval.decision === 'approve' && approval.requireReturn ? 'approve_after_return' : approval.decision;
  const trigger = {
    claimId: `apr_${approval.$id}`,
    actor: 'staff',
    actorName: staff.name,
    title: TRIGGER_TITLES[kind],
    detail: approval.staffNote,
    visibility: 'staff',
  };
  await runOnce(ctx, request, trigger, async (run) => {
    const status = await carryOut(ctx, run, request, approval);
    await run.finish(FINISH_TITLES[status]);
    ctx.log(`Request ${request.$id}: ${status} (decision by ${staff.name})`);
  });
}

/**
 * The staff member is the user whose update fired the event
 * (`x-appwrite-user-id`). Check the staff team instead of trusting the
 * decidedBy column, which any staff member can write.
 */
async function identifyStaff(ctx, approval) {
  // An update made with an API key has no user.
  if (!ctx.userId) return { name: approval.decidedByName || 'API key' };

  const { memberships } = await ctx.teams.listMemberships({
    teamId: STAFF_TEAM_ID,
    queries: [Query.equal('userId', [ctx.userId])],
  });
  const membership = memberships.find((member) => member.userId === ctx.userId && member.confirm);
  return membership ? { name: membership.userName } : null;
}

async function carryOut(ctx, run, request, approval) {
  switch (approval.decision) {
    case 'approve': {
      if (approval.requireReturn) {
        await startReturn(ctx, run, request);
        return 'awaiting_return';
      }
      // Staff can edit the approvals row, so never refund more than the item cost.
      const amountCents = Math.min(approval.amountCents, request.amountCents);
      if (amountCents < 1) throw new Error('The approved amount is $0.00.');
      const order = await ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.orders, rowId: request.orderId });
      await completeRefund(ctx, run, request, order, amountCents, { from: 'store' });
      return 'refunded';
    }

    case 'ask_customer': {
      const question = truncate(approval.staffNote?.trim() || approval.draftQuestion?.trim(), 500);
      if (!question) throw new Error('The decision has no question for the customer.');
      await ctx.tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        rowId: request.$id,
        data: { status: 'needs_customer', question, pendingApprovalId: null },
      });
      await run.tellCustomer('Question from Pourhaven', question, { from: 'store' });
      return 'needs_customer';
    }

    case 'decline': {
      const message = await run.tool('write_message', 'Writing the message to the customer', async () => ({
        result: await declineMessage(ctx, request, approval.staffNote),
        title: 'Wrote the message to the customer',
      }));
      await ctx.tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        rowId: request.$id,
        data: { status: 'declined', pendingApprovalId: null },
      });
      await run.tellCustomer('Request declined', message, { from: 'store' });
      return 'declined';
    }

    default:
      throw new Error(`Unknown decision ${approval.decision}.`);
  }
}

/** Turns the staff member's reason into a message for the customer. */
async function declineMessage(ctx, request, staffNote) {
  const fallback =
    `We reviewed your request for the ${request.itemName} and cannot offer a refund.` +
    (staffNote?.trim() ? ` ${staffNote.trim()}` : '');
  if (!staffNote?.trim()) return fallback;

  try {
    const { message } = await structuredOutput(ctx.openai, ctx.config.model, {
      name: 'decline_message',
      schema: DECLINE_SCHEMA,
      messages: [
        { role: 'system', content: DECLINE_PROMPT },
        {
          role: 'user',
          content: [
            `Item: ${request.itemName}`,
            `Reason the customer chose: ${REASON_LABELS[request.reason]}`,
            'What the customer wrote:',
            quoteCustomer(request.details),
            `Why staff declined: ${staffNote.trim()}`,
          ].join('\n'),
        },
      ],
    });
    return truncate(message.trim(), 2000) || fallback;
  } catch (err) {
    ctx.error(`Decline message used the template: ${describeError(err)}`);
    return fallback;
  }
}
