// Alarm timing. Times are the device's local time (the wall screen and phones are in the home's time zone).

export interface AlarmLike {
  id: string;
  at_time: string;          // "HH:MM" or "HH:MM:SS"
  days: number[];           // 0 = Sunday … 6 = Saturday; empty = once (on_date)
  on_date: string | null;   // "YYYY-MM-DD" for a one-off
  enabled: boolean;
  last_dismissed_for: string | null;
  snoozed_until: string | null;
}

/** How long an alarm keeps ringing if nobody stops it. */
export const RING_FOR_MS = 30 * 60 * 1000;

function at(dateIso: string | null, base: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = dateIso ? new Date(`${dateIso}T00:00`) : new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** The most recent time this alarm was due, at or before `now` (looks back a week). */
export function lastOccurrence(a: AlarmLike, now: Date): Date | null {
  if (a.days.length === 0) {
    if (!a.on_date) return null;
    const t = at(a.on_date, now, a.at_time);
    return t <= now ? t : null;
  }
  for (let back = 0; back <= 7; back++) {
    const day = new Date(now);
    day.setDate(day.getDate() - back);
    if (!a.days.includes(day.getDay())) continue;
    const t = at(null, day, a.at_time);
    if (t <= now) return t;
  }
  return null;
}

/** The next time this alarm will go off after `now`, for showing in the list. */
export function nextOccurrence(a: AlarmLike, now: Date): Date | null {
  if (!a.enabled) return null;
  if (a.days.length === 0) {
    if (!a.on_date) return null;
    const t = at(a.on_date, now, a.at_time);
    return t > now ? t : null;
  }
  for (let ahead = 0; ahead <= 7; ahead++) {
    const day = new Date(now);
    day.setDate(day.getDate() + ahead);
    if (!a.days.includes(day.getDay())) continue;
    const t = at(null, day, a.at_time);
    if (t > now) return t;
  }
  return null;
}

/** The occurrence that is ringing right now, or null. Stopping it anywhere stops it everywhere. */
export function ringingOccurrence(a: AlarmLike, now: Date): Date | null {
  if (!a.enabled) return null;
  const occ = lastOccurrence(a, now);
  if (!occ) return null;
  if (a.last_dismissed_for && new Date(a.last_dismissed_for).getTime() >= occ.getTime()) return null;
  if (a.snoozed_until && new Date(a.snoozed_until) > now) return null;
  const startedAt = a.snoozed_until && new Date(a.snoozed_until) > occ ? new Date(a.snoozed_until) : occ;
  if (now.getTime() - startedAt.getTime() > RING_FOR_MS) return null;
  return occ;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function daysLabel(days: number[], onDate: string | null): string {
  if (days.length === 0) {
    return onDate ? new Date(`${onDate}T00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Once';
  }
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Every day';
  if (set.join() === '1,2,3,4,5') return 'Weekdays';
  if (set.join() === '0,6') return 'Weekends';
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.includes(d)).map((d) => DAY_SHORT[d]).join(', ');
}
