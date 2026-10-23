/** The Oviemeter genie: spend 3 points on a wish (anything, in writing) that someone else has to grant within
 *  3 days. Granted: the wisher pays 3 points. Not granted in time: the other person loses 3 (done by the database). */

export const WISH_COST = 3;
export const WISH_DAYS = 3;

export interface Wish {
  id: string;
  from_member: string;
  to_member: string;
  wish: string;
  created_at: string;
  due_at: string;
  granted_at: string | null;
  missed_at: string | null;
}
export const WISH_COLS = 'id,from_member,to_member,wish,created_at,due_at,granted_at,missed_at';

export const isOpen = (w: Wish) => !w.granted_at && !w.missed_at;

/** Points someone has free for a new wish: their score less 3 for each wish of theirs still waiting. */
export function wishPointsFree(score: number, wishes: Wish[], memberId: string): number {
  const waiting = wishes.filter((w) => w.from_member === memberId && isOpen(w)).length;
  return score - waiting * WISH_COST;
}
export const canWish = (score: number, wishes: Wish[], memberId: string) => wishPointsFree(score, wishes, memberId) >= WISH_COST;

/** "2 days 5 h left", "3 h left", "40 min left", "Time's up". */
export function timeLeft(dueAt: string, now = Date.now()): string {
  const mins = Math.floor((new Date(dueAt).getTime() - now) / 60000);
  if (mins <= 0) return "Time's up";
  if (mins < 60) return `${mins} min left`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h left`;
  const d = Math.floor(h / 24), rest = h % 24;
  return `${d} day${d === 1 ? '' : 's'}${rest ? ` ${rest} h` : ''} left`;
}

/** Waiting wishes first (soonest due), then the rest newest first. */
export function sortWishes(wishes: Wish[]): Wish[] {
  const open = wishes.filter(isOpen).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const done = wishes.filter((w) => !isOpen(w)).sort((a, b) =>
    (b.granted_at ?? b.missed_at ?? '').localeCompare(a.granted_at ?? a.missed_at ?? ''));
  return [...open, ...done];
}
