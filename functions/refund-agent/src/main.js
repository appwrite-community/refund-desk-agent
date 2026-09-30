import { decisionJob } from './jobs/decision.js';
import { intakeJob } from './jobs/intake.js';
import { replyJob } from './jobs/reply.js';
import { returnCheckJob } from './jobs/return-check.js';
import { createContext } from './lib/context.js';
import { describeError } from './lib/format.js';
import { routeExecution } from './lib/routing.js';

const JOBS = {
  intake: intakeJob,
  decision: decisionJob,
  reply: replyJob,
  return_check: returnCheckJob,
};

// Started by row events (a new request, a staff decision, a customer answer)
// and by delayed executions it queues itself (return checks). Every run
// rebuilds the case from TablesDB, does its part, and ends.
export default async ({ req, res, log, error }) => {
  const route = routeExecution(req.headers, req.bodyText);
  if (!route) {
    log(`Nothing to do for trigger "${req.headers['x-appwrite-trigger']}".`);
    return res.empty();
  }

  const ctx = createContext({ req, log, error });
  try {
    await JOBS[route.job](ctx, route);
    return res.empty();
  } catch (err) {
    error(`Job ${route.job} failed: ${describeError(err)}`);
    return res.json({ job: route.job, error: 'failed' }, 500);
  }
};
