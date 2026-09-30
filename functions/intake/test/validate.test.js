import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError, validateReply, validateRequest } from '../src/validate.js';

const valid = { orderId: 'ph-20417', itemSku: 'CAR-600', reason: 'damaged', details: ' Cracked. ', photoId: 'abc123' };

const rejects = (fn, status, code) =>
  assert.throws(fn, (err) => err instanceof HttpError && err.status === status && err.code === code);

test('a complete request passes and the text is trimmed', () => {
  assert.deepEqual(validateRequest(valid), { ...valid, details: 'Cracked.' });
});

test('a photo is required unless the customer changed their mind', () => {
  rejects(() => validateRequest({ ...valid, photoId: null }), 422, 'photo_required');
  assert.equal(validateRequest({ ...valid, reason: 'changed_mind', photoId: null }).photoId, null);
});

test('unknown reasons, empty text, and long text are rejected', () => {
  rejects(() => validateRequest({ ...valid, reason: 'free_money' }), 400, 'invalid_input');
  rejects(() => validateRequest({ ...valid, details: '   ' }), 400, 'invalid_input');
  rejects(() => validateRequest({ ...valid, details: 'x'.repeat(1001) }), 400, 'invalid_input');
});

test('IDs must look like Appwrite IDs', () => {
  rejects(() => validateRequest({ ...valid, orderId: '../orders' }), 400, 'invalid_input');
  rejects(() => validateRequest({ ...valid, photoId: 'x'.repeat(37) }), 400, 'invalid_input');
});

test('replies need a message and allow an optional photo', () => {
  assert.deepEqual(validateReply({ message: ' Still broken. ' }), { message: 'Still broken.', photoId: null });
  rejects(() => validateReply({ message: '' }), 400, 'invalid_input');
  rejects(() => validateReply({ message: 'x'.repeat(2001) }), 400, 'invalid_input');
});
