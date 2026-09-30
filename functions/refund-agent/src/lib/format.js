export const DAY_MS = 24 * 60 * 60 * 1000;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthDayYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export const money = (cents) => usd.format(cents / 100);
export const shortDate = (date) => monthDay.format(new Date(date));
/** Dates the model reads and repeats to staff, for example Sep 21, 2026. */
export const longDate = (date) => monthDayYear.format(new Date(date));
/** Whole calendar days (UTC) between a date and now, so the count does not change during the day. */
export const daysSince = (date, now = Date.now()) => Math.floor(now / DAY_MS) - Math.floor(new Date(date).getTime() / DAY_MS);

/** The number customers and staff see, for example #1043. */
export const requestNumber = (row) => 1000 + Number(row.$sequence);

export const REASON_LABELS = {
  damaged: 'Arrived damaged',
  defective: 'Stopped working',
  wrong_item: 'Wrong item received',
  changed_mind: 'Changed my mind',
};

export function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Safe fields of an error. Never log raw Appwrite errors: they can include request data. */
export function describeError(err) {
  const message = err?.message ?? String(err);
  const labels = [err?.code, err?.type].filter((label) => label && !message.startsWith(String(label)));
  return truncate([...labels, message].join(' '), 300);
}
