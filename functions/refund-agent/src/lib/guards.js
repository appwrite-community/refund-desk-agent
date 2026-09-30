import { daysSince, money } from './format.js';

const AUTO_REFUND_REASONS = ['damaged', 'defective', 'wrong_item'];

/**
 * The rules for refunding without a person. The model can ask for an automatic
 * refund, but only this code decides whether money moves. Returns the rules that
 * fail, each with a sentence staff (and the model) can read. An empty list
 * means the request qualifies.
 */
export function checkAutoRefund({ job, request, order, history, inspection, config, now = Date.now() }) {
  const failures = [];
  const fail = (rule, message) => failures.push({ rule, message });

  if (job !== 'intake') {
    fail('first_review', 'Staff already reviewed this request, so a person makes the decision.');
  }

  if (!AUTO_REFUND_REASONS.includes(request.reason)) {
    fail('reason', 'Change-of-mind refunds need the item back first.');
  }

  if (request.amountCents > config.autoRefundLimitCents) {
    fail('limit', `${money(request.amountCents)} is above the ${money(config.autoRefundLimitCents)} automatic refund limit.`);
  }

  if (!order.deliveredAt) {
    fail('window', 'The order has no delivery date.');
  } else {
    const days = daysSince(order.deliveredAt, now);
    if (days > config.refundWindowDays) {
      fail('window', `Delivered ${days} days ago, outside the ${config.refundWindowDays}-day window for automatic refunds.`);
    }
  }

  if (AUTO_REFUND_REASONS.includes(request.reason)) {
    if (!request.photoId) fail('photo', 'The request has no photo.');
    else if (!inspection) fail('photo', 'The photo was not inspected in this review.');
    else if (inspection.supportsClaim !== 'yes') {
      fail('photo', 'The photo does not clearly show the problem the customer describes.');
    }
  }

  if (history.refundsLast90Days > 0) {
    const count = history.refundsLast90Days;
    fail('history', `The customer had ${count} ${count === 1 ? 'refund' : 'refunds'} in the last 90 days.`);
  }

  return failures;
}
