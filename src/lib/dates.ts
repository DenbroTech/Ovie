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
}

export interface Occurrence<E extends EventLike> {
  event: E;
  start: Date;
  end: Date | null;
  day: string; // ISO date of the occurrence (device local)
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

/** All occurrences that start on a day between fromIso and toIso (inclusive), sorted by start. */
export function expandEvents<E extends EventLike>(events: E[], fromIso: string, toIsoStr: string): Occurrence<E>[] {
  const from = parseIso(fromIso).getTime();
  const to = parseIso(addDays(toIsoStr, 1)).getTime();
  const out: Occurrence<E>[] = [];
  for (const ev of events) {
    const start = new Date(ev.starts_at);
    const dur = ev.ends_at ? new Date(ev.ends_at).getTime() - start.getTime() : null;
    if (ev.repeat === 'none') {
      if (start.getTime() < to && (start.getTime() >= from || (dur !== null && start.getTime() + dur > from))) {
        out.push({ event: ev, start, end: dur === null ? null : new Date(start.getTime() + dur), day: toIso(start) });
      }
      continue;
    }
    // jump close to the window, then walk forward
    let n = 0;
    if (start.getTime() < from) {
      const approx = ev.repeat === 'weekly' ? 7 : ev.repeat === 'monthly' ? 28 : 365;
      n = Math.max(0, Math.floor((from - start.getTime()) / (approx * 86_400_000)) - 1);
    }
    for (let guard = 0; guard < 600; guard++, n++) {
      const s = step(start, ev.repeat, n);
      if (s.getTime() >= to) break;
      if (s.getTime() >= from) {
        out.push({ event: ev, start: s, end: dur === null ? null : new Date(s.getTime() + dur), day: toIso(s) });
      }
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
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
