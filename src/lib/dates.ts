// Date helpers. Dates are ISO strings "YYYY-MM-DD" in the household's time zone.

export function isoInZone(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todayIso(timeZone?: string): string {
  return isoInZone(new Date(), timeZone);
}

/** Parse "YYYY-MM-DD" as a local calendar date (no time zone shifting). */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(fromIso: string, toIsoStr: string): number {
  return Math.round((parseIso(toIsoStr).getTime() - parseIso(fromIso).getTime()) / 86_400_000);
}

/** "Today", "Tomorrow", "Yesterday", "Mon 12 Oct", or with year if not this year. */
export function dayLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = parseIso(iso);
  const sameYear = d.getFullYear() === parseIso(today).getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export type RepeatUnit = 'day' | 'week' | 'month';

export function repeatLabel(every: number | null, unit: RepeatUnit | null): string | null {
  if (!every || !unit) return null;
  if (every === 1) return unit === 'day' ? 'Every day' : unit === 'week' ? 'Every week' : 'Every month';
  if (every === 2 && unit === 'week') return 'Every fortnight';
  return `Every ${every} ${unit}s`;
}

// ---------- calendar ----------

export type EventRepeat = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface EventLike {
  id: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  repeat: EventRepeat;
  /** repeat every N weeks / months / years (1 if missing) */
  repeat_every?: number | null;
}

export interface Occurrence<E extends EventLike> {
  event: E;
  start: Date;
  end: Date | null;
  day: string; // ISO date of the occurrence (device local)
  /** for an event over several days: which day this is (0 = the first) and how many days it covers */
  dayIndex?: number;
  days?: number;
}

const everyOf = (ev: { repeat_every?: number | null }) => Math.max(1, Math.min(52, ev.repeat_every ?? 1));

/** "Every week", "Every 2 weeks", "Every 3 months", "Every year" */
export function repeatText(repeat: EventRepeat, every: number | null | undefined = 1): string {
  if (repeat === 'none') return 'Does not repeat';
  const n = Math.max(1, every ?? 1);
  const unit = repeat === 'weekly' ? 'week' : repeat === 'monthly' ? 'month' : 'year';
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}

function step(d: Date, repeat: EventRepeat, n: number): Date {
  const x = new Date(d);
  if (repeat === 'weekly') x.setDate(x.getDate() + 7 * n);
  else if (repeat === 'monthly') {
    const day = d.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + n);
    const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last)); // 31st → last day of shorter months
  } else if (repeat === 'yearly') {
    const month = d.getMonth();
    x.setDate(1);
    x.setFullYear(x.getFullYear() + n);
    x.setMonth(month);
    const last = new Date(x.getFullYear(), month + 1, 0).getDate();
    x.setDate(Math.min(d.getDate(), last)); // 29 Feb → 28 Feb
  }
  return x;
}

/** All occurrences on days between fromIso and toIso (inclusive), sorted by start. An event that runs over several
 *  days (a weekend away, a holiday) gives one occurrence per day it covers, numbered with dayIndex / days. */
export function expandEvents<E extends EventLike>(events: E[], fromIso: string, toIsoStr: string): Occurrence<E>[] {
  const from = parseIso(fromIso).getTime();
  const to = parseIso(addDays(toIsoStr, 1)).getTime();
  const out: Occurrence<E>[] = [];
  const add = (ev: E, s: Date, dur: number | null) => {
    const end = dur === null ? null : new Date(s.getTime() + dur);
    const first = toIso(s);
    const last = end && end.getTime() > s.getTime() ? toIso(new Date(end.getTime() - 1)) : first;
    const days = Math.min(daysBetween(first, last) + 1, 366);
    for (let i = 0; i < days; i++) {
      const day = addDays(first, i);
      if (day < fromIso || day > toIsoStr) continue;
      out.push(days > 1 ? { event: ev, start: s, end, day, dayIndex: i, days } : { event: ev, start: s, end, day });
    }
  };
  for (const ev of events) {
    const start = new Date(ev.starts_at);
    const dur = ev.ends_at ? new Date(ev.ends_at).getTime() - start.getTime() : null;
    if (ev.repeat === 'none') {
      if (start.getTime() < to && (start.getTime() >= from || (dur !== null && start.getTime() + dur > from))) add(ev, start, dur);
      continue;
    }
    // jump close to the window (a little before, for events that run over several days), then walk forward
    let n = 0;
    const lead = Math.max(0, dur ?? 0);
    if (start.getTime() < from - lead) {
      const approx = (ev.repeat === 'weekly' ? 7 : ev.repeat === 'monthly' ? 28 : 365) * everyOf(ev);
      n = Math.max(0, Math.floor((from - lead - start.getTime()) / (approx * 86_400_000)) - 1);
    }
    for (let guard = 0; guard < 600; guard++, n++) {
      const s = step(start, ev.repeat, n * everyOf(ev));
      if (s.getTime() >= to) break;
      if (s.getTime() >= from || (dur !== null && s.getTime() + dur > from)) add(ev, s, dur);
    }
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.start.getTime() - b.start.getTime()));
}

/** How a day of an event reads in a list: a time, "All day", or for one running over several days
 *  "6:00 PM →" on its first day, "All day" in between and "until 2:00 PM" on its last. */
export function occurrenceWhen(o: { event: { all_day: boolean }; start: Date; end: Date | null; dayIndex?: number; days?: number },
  time: (d: Date) => string): string {
  if (!o.days || o.days < 2) return o.event.all_day ? 'All day' : time(o.start);
  if (o.event.all_day) return `Day ${(o.dayIndex ?? 0) + 1} of ${o.days}`;
  if (o.dayIndex === 0) return `${time(o.start)} →`;
  if (o.dayIndex === o.days - 1 && o.end) return `until ${time(o.end)}`;
  return 'All day';
}

/** Countdowns for the wall: the next few one-off, monthly or yearly events (weekly ones aren't worth counting down to). */
export function countdowns<E extends EventLike>(events: E[], today: string, horizonDays = 90, max = 3): Array<{ event: E; day: string; days: number }> {
  const seen = new Set<string>();
  const out: Array<{ event: E; day: string; days: number }> = [];
  for (const o of expandEvents(events.filter((e) => e.repeat !== 'weekly'), addDays(today, 1), addDays(today, horizonDays))) {
    if (seen.has(o.event.id) || (o.dayIndex ?? 0) > 0) continue; // already under way: nothing to count down to
    seen.add(o.event.id);
    out.push({ event: o.event, day: o.day, days: daysBetween(today, o.day) });
    if (out.length === max) break;
  }
  return out;
}

export function timeLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ---------- watch ----------

/** The next unwatched episode after the furthest one watched, or null when finished. */
export function nextEpisode(seasons: number[], watched: Array<{ season: number; episode: number }>): { season: number; episode: number } | null {
  if (seasons.length === 0) return null;
  let s = 1;
  let e = 0;
  for (const w of watched) {
    if (w.season > s || (w.season === s && w.episode > e)) {
      s = w.season;
      e = w.episode;
    }
  }
  if (e < (seasons[s - 1] ?? 0)) return { season: s, episode: e + 1 };
  if (s < seasons.length) return { season: s + 1, episode: 1 };
  return null;
}

export function totalEpisodes(seasons: number[]): number {
  return seasons.reduce((a, b) => a + b, 0);
}

/** "10, 8, 12" → [10, 8, 12]; returns null if it doesn't make sense. */
export function parseSeasons(text: string): number[] | null {
  const t = text.trim();
  if (!t) return [];
  const parts = t.split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isInteger(n) || n < 1 || n > 500) || parts.length > 60) return null;
  return parts;
}

export function money(n: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}
