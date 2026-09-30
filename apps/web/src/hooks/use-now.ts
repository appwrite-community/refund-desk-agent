import { useEffect, useState } from 'react';

/** The current time, refreshed on an interval, for live timers such as "Waiting 2h 14m". */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
