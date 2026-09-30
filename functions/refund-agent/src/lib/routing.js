const ROW_EVENT = /^tablesdb\.[^.]+\.tables\.([^.]+)\.rows\.(.+)\.(create|update)$/;

const EVENT_JOBS = {
  'refund_requests.create': 'intake',
  'approvals.update': 'decision',
  'replies.create': 'reply',
};

/**
 * Picks the job for an execution: row events carry the event name in
 * `x-appwrite-event`, and delayed executions carry a JSON body this function
 * wrote itself. Anything else returns null.
 */
export function routeExecution(headers, bodyText) {
  const trigger = headers['x-appwrite-trigger'];

  if (trigger === 'event') {
    const match = ROW_EVENT.exec(headers['x-appwrite-event'] ?? '');
    const job = match && EVENT_JOBS[`${match[1]}.${match[3]}`];
    return job ? { job, rowId: match[2] } : null;
  }

  if (trigger === 'schedule') {
    let body;
    try {
      body = JSON.parse(bodyText || '{}');
    } catch {
      return null;
    }
    if (body.type === 'return_check' && typeof body.requestId === 'string' && Number.isInteger(body.attempt)) {
      return { job: 'return_check', requestId: body.requestId, attempt: body.attempt };
    }
  }

  return null;
}
