const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthDayTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const fullTimestamp = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

export const toMs = (value: string | number | Date) => new Date(value).getTime();

/** 12900 -> "$129.00" */
export const money = (cents: number) => usd.format(cents / 100);

/** "Sep 24" */
export const shortDate = (value: string | number | Date) => monthDay.format(new Date(value));

/** "Sep 24, 3:04 PM" */
export const dateTime = (value: string | number | Date) => monthDayTime.format(new Date(value));

/** "Thu, Sep 24, 2026, 3:04:12 PM GMT+2", for tooltips. */
export const timestamp = (value: string | number | Date) => fullTimestamp.format(new Date(value));

/** Compact age for lists: "now", "4m", "2h", "3d". */
export function age(value: string | number | Date, now = Date.now()) {
  const elapsed = Math.max(0, now - toMs(value));
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  return `${Math.floor(elapsed / DAY)}d`;
}

/** Relative time in words: "just now", "4 min ago", "2 hours ago", "3 days ago". */
export function ago(value: string | number | Date, now = Date.now()) {
  const elapsed = Math.max(0, now - toMs(value));
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(elapsed / DAY);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Whole calendar days between a date and now. */
export const daysSince = (value: string | number | Date, now = Date.now()) =>
  Math.floor((now - toMs(value)) / DAY);

/** "Delivered today", "Delivered yesterday", "Delivered 5 days ago". */
export function deliveredAgo(value: string, now = Date.now()) {
  const days = daysSince(value, now);
  if (days <= 0) return 'Delivered today';
  if (days === 1) return 'Delivered yesterday';
  return `Delivered ${days} days ago`;
}

/** Tool durations: "164 ms", "1.2 s", "16.8 s", "2m 04s". */
export function duration(ms: number) {
  if (ms < SECOND) return `${Math.max(1, Math.round(ms))} ms`;
  if (ms < MINUTE) return `${(ms / SECOND).toFixed(1)} s`;
  const minutes = Math.floor(ms / MINUTE);
  const seconds = Math.round((ms % MINUTE) / SECOND);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Waits between runs: "49s", "14m", "2h 14m", "7d 2h". */
export function wait(ms: number) {
  const elapsed = Math.max(0, ms);
  if (elapsed < MINUTE) return `${Math.floor(elapsed / SECOND)}s`;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) {
    const minutes = Math.floor((elapsed % HOUR) / MINUTE);
    return `${Math.floor(elapsed / HOUR)}h${minutes ? ` ${minutes}m` : ''}`;
  }
  const hours = Math.floor((elapsed % DAY) / HOUR);
  return `${Math.floor(elapsed / DAY)}d${hours ? ` ${hours}h` : ''}`;
}

export const TIME = { SECOND, MINUTE, HOUR, DAY };
