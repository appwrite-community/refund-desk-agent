export const DATABASE_ID = 'refund_desk';

export const TABLES = {
  orders: 'orders',
  payments: 'payments',
  policies: 'policies',
  requests: 'refund_requests',
  steps: 'run_steps',
  approvals: 'approvals',
  replies: 'replies',
};

export const BUCKET_ID = 'request_photos';
export const STAFF_TEAM_ID = 'staff';

export const AGENT_NAME = 'Refund agent';
export const STORE_NAME = 'Pourhaven';
export const RETURN_ADDRESS = 'Pourhaven Returns, 1200 Harbor Way, Unit 4, Oakland, CA 94607';

const integer = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Settings from the function's environment variables. */
export function loadConfig(env = process.env) {
  return {
    openRouterApiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL || 'openai/gpt-6-luna',
    autoRefundLimitCents: integer(env.AUTO_REFUND_LIMIT_CENTS, 5000),
    refundWindowDays: integer(env.REFUND_WINDOW_DAYS, 30),
    returnCheckDelayMinutes: integer(env.RETURN_CHECK_DELAY_MINUTES, 7 * 24 * 60),
  };
}
