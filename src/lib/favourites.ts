/** Starred calendar entries: everything but the date, plus saved times (e.g. two work shifts). */
export interface FavTime { label: string; from: string; to: string | null } // "HH:MM"
export interface Favourite {
  id: string; title: string; notes: string | null; location: string | null;
  member_id: string | null; all_day: boolean; times: FavTime[];
}
export const FAV_COLS = 'id,title,notes,location,member_id,all_day,times';
export const MAX_TIMES = 8;

const clock = (hhmm: string) => new Date(`2000-01-01T${hhmm}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Early · 7:00 AM–3:00 PM", or just the times when there's no name. */
export function timeText(t: FavTime): string {
  const span = `${clock(t.from)}${t.to ? `–${clock(t.to)}` : ''}`;
  return t.label.trim() ? `${t.label.trim()} · ${span}` : span;
}

/** Add a time to a favourite's list (no duplicates, at most MAX_TIMES; the newest wins). */
export function withTime(times: FavTime[], t: FavTime): FavTime[] {
  const rest = times.filter((x) => !(x.from === t.from && (x.to ?? null) === (t.to ?? null)));
  return [...rest, { label: t.label.trim(), from: t.from, to: t.to || null }].slice(-MAX_TIMES);
}

/** The favourite (if any) that a title belongs to, ignoring case and spaces. */
export const findFavourite = (favs: Favourite[], title: string) =>
  favs.find((f) => f.title.trim().toLowerCase() === title.trim().toLowerCase()) ?? null;

/** Calendar rows for a favourite put on some days, each day with its own time (null = all day). */
export function eventsFor(fav: Favourite, picks: Record<string, FavTime | null>, householdId: string, createdBy: string | null) {
  return Object.entries(picks).sort(([a], [b]) => a.localeCompare(b)).map(([day, t]) => {
    const start = t ? new Date(`${day}T${t.from}`) : new Date(`${day}T00:00`);
    let end = t?.to ? new Date(`${day}T${t.to}`) : null;
    if (end && end <= start) end = new Date(end.getTime() + 86_400_000); // a shift past midnight ends the next day
    return {
      household_id: householdId, title: fav.title, notes: fav.notes, location: fav.location, member_id: fav.member_id,
      all_day: !t, starts_at: start.toISOString(), ends_at: end ? end.toISOString() : null, repeat: 'none', created_by: createdBy,
    };
  });
}
