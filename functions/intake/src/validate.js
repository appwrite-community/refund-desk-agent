export const REASONS = ['damaged', 'defective', 'wrong_item', 'changed_mind'];

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const isId = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(value);

function text(value, field, max) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new HttpError(400, 'invalid_input', `Add ${field}.`);
  if (trimmed.length > max) throw new HttpError(400, 'invalid_input', `Keep ${field} under ${max} characters.`);
  return trimmed;
}

function photoId(value) {
  if (value === undefined || value === null) return null;
  if (!isId(value)) throw new HttpError(400, 'invalid_input', 'The photo ID is not valid.');
  return value;
}

/** Checks the body of POST /requests. */
export function validateRequest(body) {
  if (!isId(body.orderId)) throw new HttpError(400, 'invalid_input', 'Choose an order.');
  if (typeof body.itemSku !== 'string' || !body.itemSku) throw new HttpError(400, 'invalid_input', 'Choose an item.');
  if (!REASONS.includes(body.reason)) throw new HttpError(400, 'invalid_input', 'Choose a reason.');

  const request = {
    orderId: body.orderId,
    itemSku: body.itemSku,
    reason: body.reason,
    details: text(body.details, 'what happened', 1000),
    photoId: photoId(body.photoId),
  };
  if (!request.photoId && request.reason !== 'changed_mind') {
    throw new HttpError(422, 'photo_required', 'Add a photo of the item.');
  }
  return request;
}

/** Checks the body of POST /requests/<requestId>/replies. */
export function validateReply(body) {
  return {
    message: text(body.message, 'your answer', 2000),
    photoId: photoId(body.photoId),
  };
}
