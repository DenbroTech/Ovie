import { addDays, daysBetween, nextEpisode, parseIso } from './dates';

/** When the next episode (or a film) comes out. All optional: no date means it's out. */
export interface ReleaseFields {
  kind: 'show' | 'film' | string;
  release_season: number | null;
  release_episode: number | null;
  release_on: string | null; // YYYY-MM-DD
  release_pace: 'all' | 'weekly' | string;
  release_days?: number[] | null; // weekly: which weekdays (0 = Sun … 6 = Sat); empty = release_on's weekday
}
export const RELEASE_COLS = 'release_season,release_episode,release_on,release_pace,release_days';

/** The date `k` episodes after the one out on `first`, when episodes come out on these weekdays. */
export function nthReleaseDay(first: string, days: number[], k: number): string {
  const set = new Set(days.length ? days : [parseIso(first).getDay()]);
  let d = first;
  for (let i = 0; i < k; i++) {
    do d = addDays(d, 1); while (!set.has(parseIso(d).getDay()));
  }
  return d;
}

/** Is this episode out yet, and if not, when does it come out (null = not known yet)?
 *  Episodes before the set one are out. From the set episode on, the rest of that season comes out
 *  the same day ("all at once") or every week on set days (e.g. Thursday and Friday). Later seasons aren't out until a new date is set. */
export function episodeRelease(t: ReleaseFields, season: number, episode: number, today: string): { out: boolean; on: string | null } {
  if (!t.release_on) return { out: true, on: null };
  if (t.kind === 'film' || t.release_season === null || t.release_episode === null) {
    return t.release_on <= today ? { out: true, on: null } : { out: false, on: t.release_on };
  }
  const rs = t.release_season, re = t.release_episode;
  if (season < rs || (season === rs && episode < re)) return { out: true, on: null };
  if (season > rs) return { out: false, on: null };
  const on = t.release_pace === 'weekly' ? nthReleaseDay(t.release_on, t.release_days ?? [], episode - re) : t.release_on;
  return on <= today ? { out: true, on: null } : { out: false, on };
}

/** The next episode to watch, only if it's out. */
export function nextOutEpisode(t: ReleaseFields & { seasons: number[] }, watched: Array<{ season: number; episode: number }>, today: string) {
  const next = nextEpisode(t.seasons, watched);
  return next && episodeRelease(t, next.season, next.episode, today).out ? next : null;
}

/** Countdowns to new episodes / films coming out soon (only ones you haven't seen). */
export function upcomingReleases<T extends ReleaseFields & { id: string; name: string; seasons: number[] }>(
  titles: T[], watchedFor: (id: string) => Array<{ season: number; episode: number }>, today: string, horizonDays = 90,
): Array<{ id: string; title: string; day: string; days: number }> {
  const out: Array<{ id: string; title: string; day: string; days: number }> = [];
  for (const t of titles) {
    if (!t.release_on) continue;
    let label = t.name, rel: { out: boolean; on: string | null };
    if (t.kind === 'film') {
      if (watchedFor(t.id).length) continue;
      rel = episodeRelease(t, 0, 0, today);
    } else {
      const next = nextEpisode(t.seasons, watchedFor(t.id));
      if (!next) continue;
      rel = episodeRelease(t, next.season, next.episode, today);
      label = `${t.name} S${next.season} E${next.episode}`;
    }
    if (rel.out || !rel.on) continue;
    const days = daysBetween(today, rel.on);
    if (days <= horizonDays) out.push({ id: `rel-${t.id}`, title: label, day: rel.on, days });
  }
  return out.sort((a, b) => a.days - b.days);
}
