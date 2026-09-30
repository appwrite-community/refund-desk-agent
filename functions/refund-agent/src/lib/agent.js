import { agentPrompt, quoteCustomer } from '../prompts.js';
import { escalate } from './approvals.js';
import { REASON_LABELS, describeError, longDate, money, requestNumber } from './format.js';
import { runToolLoop } from './model.js';
import { createToolbox } from './tools.js';

/**
 * Everything the model knows about the case, rebuilt from rows on every run.
 * The model keeps no memory between executions.
 */
export function caseFile({ request, previousApproval = null, replies = [] }) {
  const lines = [
    `Refund request #${requestNumber(request)}, submitted ${longDate(request.$createdAt)}`,
    `Item: ${request.itemName} (SKU ${request.itemSku}) from order ${request.orderNumber}`,
    `Refund amount if approved: ${money(request.amountCents)}`,
    `Reason: ${REASON_LABELS[request.reason]}`,
    `Photo on the request: ${request.photoId ? 'yes' : 'no'}`,
    'What the customer wrote:',
    quoteCustomer(request.details),
  ];
  if (previousApproval) {
    lines.push(
      '',
      `Earlier review: you recommended "${previousApproval.recommendation}". ` +
        `${previousApproval.decidedByName ?? 'A staff member'} chose to ask the customer a question.`,
    );
  }
  if (request.question) lines.push(`Question sent to the customer: ${request.question}`);
  for (const reply of replies) {
    lines.push(
      '',
      `Customer answer, ${longDate(reply.$createdAt)} (photo attached: ${reply.photoId ? 'yes' : 'no'}):`,
      quoteCustomer(reply.message),
    );
  }
  return lines.join('\n');
}

/**
 * One agent run: the model investigates with the tools and finishes with a
 * refund or a hand-off. If it fails or stops early, a person gets the request.
 */
export async function investigate(ctx, run, request, { job, previousApproval, replies }) {
  const toolbox = createToolbox(ctx, run, request, { job, replies });
  const messages = [
    { role: 'system', content: agentPrompt({ canRefund: job === 'intake' }) },
    { role: 'user', content: caseFile({ request, previousApproval, replies }) },
  ];

  let result;
  try {
    result = await runToolLoop({ openai: ctx.openai, model: ctx.config.model, messages, toolbox });
  } catch (err) {
    ctx.error(`Model request failed: ${describeError(err)}`);
    result = { stopReason: `The model request failed: ${describeError(err)}` };
  }
  if (result.outcome) return result.outcome;

  await run.error('The agent stopped before a recommendation', result.stopReason);
  const approvalId = await escalate(ctx, run, request, result.stopReason);
  return { status: 'needs_approval', recommendation: 'manual_review', approvalId };
}
