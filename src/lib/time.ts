import { useEffect, useState } from 'react';

/** Current time, re-rendering at the top of each minute (or every `stepMs`). */
export function useNow(stepMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, stepMs);
    }, stepMs - (Date.now() % stepMs));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [stepMs]);
  return now;
}

export function formatClock(d: Date, timeZone: string, locale = 'en-AU'): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(d);
}

export function formatLongDate(d: Date, timeZone: string, locale = 'en-AU'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(d);
}

/** Hour of day (0–23) in a zone, for greetings. */
export function hourIn(d: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(d);
  return Number(h);
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney';
  } catch {
    return 'Australia/Sydney';
  }
}
