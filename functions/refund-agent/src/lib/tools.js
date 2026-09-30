import { Query } from 'node-appwrite';
import { DATABASE_ID, TABLES } from '../config.js';
import { requestApproval } from './approvals.js';
import { daysSince, describeError, longDate, money, requestNumber } from './format.js';
import { checkAutoRefund } from './guards.js';
import { inspectPhoto } from './photo.js';
import { completeRefund } from './refunds.js';

export const POLICY_TOPICS = [
  'overview',
  'automatic_refunds',
  'damaged_in_transit',
  'defective',
  'wrong_item',
  'changed_mind',
  'returns',
];
const RECOMMENDATIONS = ['refund', 'refund_after_return', 'decline', 'ask_customer'];

/** A strict function tool: every property is required and nothing else is allowed. */
const tool = (name, description, properties = {}) => ({
  type: 'function',
  function: {
    name,
    description,
    strict: true,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  },
});

// No tool takes a request, order, or customer ID. Every tool is bound to the
// request under review, so the model cannot look at or act on another one.
export const TOOL_DEFINITIONS = [
  tool('get_order', 'Look up the order for this request: items, prices, delivery date, and payment card.'),
  tool('get_refund_history', "Look up the customer's earlier refund requests and refunds."),
  tool('read_policy', 'Read one section of the store refund policy.', {
    topic: { type: 'string', enum: POLICY_TOPICS },
  }),
  tool('inspect_photo', "Inspect a photo from the customer: the one on the request or the one on their latest answer.", {
    source: { type: 'string', enum: ['request', 'latest_reply'] },
  }),
  tool(
    'issue_refund',
    'Refund the full item price to the original card. Code checks the automatic refund rules first and returns the rules that fail.',
    { reason: { type: 'string', description: 'One sentence for staff on why this case qualifies.' } },
  ),
  tool('request_approval', 'Hand the request to staff with your recommendation. A staff member decides.', {
    recommendation: { type: 'string', enum: RECOMMENDATIONS },
    findings: { type: 'array', items: { type: 'string' }, description: 'Facts that support the recommendation.' },
    concerns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Problems or risks you found. Code adds the automatic refund rules that fail, so do not repeat them.',
    },
    reasoning: { type: 'string', description: 'At most four sentences for the staff member who decides.' },
    draftQuestion: {
      type: ['string', 'null'],
      description: 'The question for the customer when recommending ask_customer, otherwise null.',
    },
  }),
];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

function deliveredText(days) {
  if (days === null) return 'Not delivered yet';
  if (days === 0) return 'Delivered today';
  return `Delivered ${plural(days, 'day')} ago`;
}

function recommendationText(recommendation, amountCents) {
  switch (recommendation) {
    case 'refund':
      return `recommends a refund of ${money(amountCents)}`;
    case 'refund_after_return':
      return `recommends a refund of ${money(amountCents)} after a return`;
    case 'decline':
      return 'recommends declining';
    default:
      return 'recommends asking the customer';
  }
}

/** The customer's other requests and refunds, newest first. */
async function loadHistory(ctx, request) {
  const [requests, refunds] = await Promise.all([
    ctx.tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.requests,
      queries: [Query.equal('customerId', [request.customerId]), Query.orderDesc('$createdAt'), Query.limit(25)],
    }),
    ctx.tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.payments,
      queries: [
        Query.equal('customerId', [request.customerId]),
        Query.equal('kind', ['refund']),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ],
    }),
  ]);
  const earlierRefunds = refunds.rows.filter((refund) => refund.requestId !== request.$id);
  const refundsWithin = (days) => earlierRefunds.filter((refund) => daysSince(refund.$createdAt) <= days).length;
  return {
    refundsLast90Days: refundsWithin(90),
    refundsLast365Days: refundsWithin(365),
    previousRequests: requests.rows
      .filter((row) => row.$id !== request.$id)
      .map((row) => ({
        number: requestNumber(row),
        item: row.itemName,
        amount: money(row.amountCents),
        reason: row.reason,
        status: row.status,
        date: longDate(row.$createdAt),
      })),
  };
}

/**
 * The tools for one run, bound to one request. `outcome` is set when a
 * finishing tool (issue_refund or request_approval) succeeds.
 */
export function createToolbox(ctx, run, request, { job, replies = [] }) {
  const canRefund = job === 'intake';
  const latestReplyWithPhoto = [...replies].reverse().find((row) => row.photoId);
  const photoSources = [request.photoId && 'request', latestReplyWithPhoto && 'latest_reply'].filter(Boolean);
  const inspections = {};
  const inspected = new Set();
  const cache = new Map();
  const once = (key, load) => {
    if (!cache.has(key)) {
      const pending = load();
      pending.catch(() => cache.delete(key)); // A failed lookup can be retried.
      cache.set(key, pending);
    }
    return cache.get(key);
  };
  const order = () =>
    once('order', () => ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.orders, rowId: request.orderId }));
  const history = () => once('history', () => loadHistory(ctx, request));

  // The same rules decide automatic refunds and list the concerns on a hand-off.
  const failedRules = async () =>
    checkAutoRefund({
      job,
      request,
      order: await order(),
      history: await history(),
      inspection: inspections.request ?? inspections.latest_reply,
      config: ctx.config,
    });

  let outcome = null;

  const handlers = {
    get_order: () =>
      run.tool('get_order', 'Looking up the order', async () => {
        const row = await order();
        const items = JSON.parse(row.items);
        const days = row.deliveredAt ? daysSince(row.deliveredAt) : null;
        return {
          result: {
            orderNumber: row.number,
            status: row.status,
            placedOn: longDate(row.placedAt),
            deliveredOn: row.deliveredAt ? longDate(row.deliveredAt) : null,
            daysSinceDelivery: days,
            items: items.map((item) => ({ ...item, unitPrice: money(item.unitPriceCents) })),
            requestedItem: { sku: request.itemSku, name: request.itemName, refundAmount: money(request.amountCents) },
            payment: { brand: row.cardBrand, last4: row.cardLast4 },
          },
          title: `Looked up order ${row.number}`,
          detail: `${deliveredText(days)}. ${plural(items.length, 'item')}. Paid with ${row.cardBrand} ending ${row.cardLast4}.`,
        };
      }),

    get_refund_history: () =>
      run.tool('get_refund_history', 'Checking refund history', async () => {
        const result = await history();
        const detail =
          result.refundsLast365Days === 0
            ? 'No refunds in the last 12 months.'
            : `${plural(result.refundsLast90Days, 'refund')} in the last 90 days, ${result.refundsLast365Days} in the last 12 months.`;
        return { result, title: 'Checked refund history', detail };
      }),

    read_policy: ({ topic }) =>
      run.tool('read_policy', 'Reading the refund policy', async () => {
        if (!POLICY_TOPICS.includes(topic)) throw new Error(`Unknown policy topic ${topic}.`);
        const policy = await ctx.tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.policies, rowId: topic });
        return {
          result: { title: policy.title, body: policy.body },
          title: `Read policy: ${policy.title}`,
          detail: policy.body,
        };
      }),

    inspect_photo: ({ source }) =>
      run.tool('inspect_photo', source === 'latest_reply' ? 'Inspecting the photo in the answer' : 'Inspecting the photo', async () => {
        const [fileId, customerText] =
          source === 'latest_reply'
            ? [latestReplyWithPhoto?.photoId, latestReplyWithPhoto?.message]
            : [request.photoId, request.details];
        if (!fileId) {
          return { result: { photo: 'missing' }, title: 'No photo to inspect', detail: `No photo on the ${source === 'latest_reply' ? 'answer' : 'request'}.` };
        }
        inspected.add(source); // Counts even if the inspection fails, so a broken photo cannot block the hand-off.
        const inspection = await inspectPhoto(ctx, { fileId, itemName: request.itemName, reason: request.reason, customerText });
        inspections[source] = inspection;
        return {
          result: inspection,
          title: source === 'latest_reply' ? 'Inspected the photo in the answer' : 'Inspected the photo',
          detail: `${inspection.description} ${inspection.explanation}`,
        };
      }),

    request_approval: (args) => {
      // Checked before the step is written: a rejected call goes back to the model, not to the timeline.
      if (!RECOMMENDATIONS.includes(args.recommendation)) throw new Error('Choose one of the listed recommendations.');
      if (args.recommendation === 'ask_customer' && !args.draftQuestion?.trim()) {
        throw new Error('Write the question for the customer in draftQuestion.');
      }
      const uninspected = photoSources.find((source) => !inspected.has(source));
      if (uninspected) throw new Error(`Staff need every photo checked. Call inspect_photo with source "${uninspected}" first.`);

      return run.tool('request_approval', 'Preparing the hand-off to staff', async () => {
        const ruleConcerns = (await failedRules()).filter((rule) => rule.rule !== 'first_review').map((rule) => rule.message);
        const approvalId = await requestApproval(ctx, run, request, {
          recommendation: args.recommendation,
          findings: strings(args.findings),
          concerns: [...ruleConcerns, ...strings(args.concerns)],
          reasoning: args.reasoning ?? '',
          draftQuestion: args.draftQuestion,
        });
        outcome = { status: 'needs_approval', recommendation: args.recommendation, approvalId };
        return {
          result: { ok: true, approvalId },
          title: `Sent to staff: ${recommendationText(args.recommendation, request.amountCents)}`,
          detail: args.reasoning,
        };
      });
    },
  };

  if (canRefund) {
    handlers.issue_refund = ({ reason }) =>
      run.tool('issue_refund', 'Checking the automatic refund rules', async () => {
        const failures = await failedRules();
        if (failures.length > 0) {
          return {
            result: {
              ok: false,
              failedRules: failures,
              next: 'Call request_approval. Staff see these failed rules as concerns already, so do not repeat them in concerns.',
            },
            title: 'Automatic refund blocked',
            detail: failures.map((failure) => failure.message).join(' '),
          };
        }
        const refund = await completeRefund(ctx, run, request, await order(), request.amountCents);
        outcome = { status: 'refunded', reference: refund.reference };
        return {
          result: { ok: true, reference: refund.reference },
          title: 'All automatic refund rules passed',
          detail: reason,
        };
      });
  }

  return {
    definitions: TOOL_DEFINITIONS.filter((definition) => handlers[definition.function.name]),
    get outcome() {
      return outcome;
    },
    /** Runs one tool call. Errors go back to the model as JSON so it can recover. */
    async call(name, argumentsText) {
      const handler = handlers[name];
      if (!handler) return { error: `There is no tool named ${name}.` };
      let args;
      try {
        args = JSON.parse(argumentsText || '{}');
      } catch {
        return { error: 'The tool arguments were not valid JSON.' };
      }
      try {
        return await handler(args);
      } catch (err) {
        ctx.log(`Tool ${name} failed: ${describeError(err)}`);
        return { error: describeError(err) };
      }
    },
  };
}
