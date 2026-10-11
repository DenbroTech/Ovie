import type { SheepMood } from '../components/OvieSheep';

/** Which Ovie to show when — kept in one place so the rules are easy to change. */
export const HUNGRY_AT = 9; // this many things on the shopping list makes Ovie hungry

/** Home / screensaver: a birthday today beats everything, then sleepy at night, else happy. */
export function dayMood(opts: { night: boolean; todayTitles: string[] }): SheepMood {
  if (opts.todayTitles.some((t) => /birthday|b'?day|anniversary/i.test(t))) return 'celebrating';
  return opts.night ? 'sleepy' : 'happy';
}

/** Notes: surprised by a brand-new note (last hour, from someone else), in love when there's one for you. */
export function notesMood<N extends { from_member: string | null; to_member: string | null; created_at: string }>(
  open: N[], me: string | null, now = new Date(),
): SheepMood {
  const fresh = open.some((n) => n.from_member !== me && now.getTime() - new Date(n.created_at).getTime() < 60 * 60_000);
  if (fresh) return 'surprised';
  if (open.some((n) => (me ? n.to_member === me : n.to_member !== null))) return 'in-love';
  return 'thinking';
}

export const shoppingMood = (toBuy: number): SheepMood => (toBuy >= HUNGRY_AT ? 'hungry' : 'shopping');
