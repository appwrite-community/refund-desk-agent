import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAutoRefund } from '../src/lib/guards.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-09-29T12:00:00Z');
const config = { autoRefundLimitCents: 5000, refundWindowDays: 30 };

const clearCase = () => ({
  job: 'intake',
  request: { reason: 'damaged', amountCents: 3400, photoId: 'photo1' },
  order: { deliveredAt: new Date(now - 5 * DAY).toISOString() },
  history: { refundsLast90Days: 0 },
  inspection: { supportsClaim: 'yes' },
  config,
  now,
});

const rules = (input) => checkAutoRefund(input).map((failure) => failure.rule);

test('a small, recent, photographed case with no history passes', () => {
  assert.deepEqual(checkAutoRefund(clearCase()), []);
});

test('only the first review can refund automatically', () => {
  assert.deepEqual(rules({ ...clearCase(), job: 'reply' }), ['first_review']);
});

test('change of mind never refunds automatically', () => {
  const input = clearCase();
  input.request = { ...input.request, reason: 'changed_mind', photoId: null };
  assert.deepEqual(rules(input), ['reason']);
});

test('amounts above the limit need staff, and the message names both amounts', () => {
  const input = clearCase();
  input.request = { ...input.request, amountCents: 12900 };
  const failures = checkAutoRefund(input);
  assert.deepEqual(failures.map((failure) => failure.rule), ['limit']);
  assert.equal(failures[0].message, '$129.00 is above the $50.00 automatic refund limit.');
});

test('the limit is inclusive', () => {
  const input = clearCase();
  input.request = { ...input.request, amountCents: 5000 };
  assert.deepEqual(rules(input), []);
});

test('deliveries outside the window need staff', () => {
  const input = clearCase();
  input.order = { deliveredAt: new Date(now - 31 * DAY).toISOString() };
  const failures = checkAutoRefund(input);
  assert.deepEqual(failures.map((failure) => failure.rule), ['window']);
  assert.match(failures[0].message, /Delivered 31 days ago/);
});

test('an order without a delivery date fails the window rule', () => {
  assert.deepEqual(rules({ ...clearCase(), order: { deliveredAt: null } }), ['window']);
});

test('the photo must be inspected in this run and support the claim', () => {
  assert.deepEqual(rules({ ...clearCase(), inspection: undefined }), ['photo']);
  assert.deepEqual(rules({ ...clearCase(), inspection: { supportsClaim: 'unclear' } }), ['photo']);
  assert.deepEqual(rules({ ...clearCase(), inspection: { supportsClaim: 'no' } }), ['photo']);
  const noPhoto = clearCase();
  noPhoto.request = { ...noPhoto.request, photoId: null };
  assert.deepEqual(rules(noPhoto), ['photo']);
});

test('a refund in the last 90 days needs staff', () => {
  const failures = checkAutoRefund({ ...clearCase(), history: { refundsLast90Days: 2 } });
  assert.deepEqual(failures.map((failure) => failure.rule), ['history']);
  assert.equal(failures[0].message, 'The customer had 2 refunds in the last 90 days.');
});

test('every failing rule is reported', () => {
  const input = {
    ...clearCase(),
    job: 'reply',
    history: { refundsLast90Days: 1 },
    inspection: { supportsClaim: 'no' },
  };
  input.request = { ...input.request, amountCents: 24900 };
  input.order = { deliveredAt: new Date(now - 45 * DAY).toISOString() };
  assert.deepEqual(rules(input), ['first_review', 'limit', 'window', 'photo', 'history']);
});
