/** The Oviemeter: everyone's score from -10 (little devil) to +10 (angel). Points are given by someone else,
 *  always with a reason; the score is the running total, held between -10 and +10 as it goes. */

export const METER_MAX = 10;

export interface MeterPoint {
  id: string;
  to_member: string;
  from_member: string | null;
  points: number;
  reason: string;
  created_at: string;
}
export const METER_COLS = 'id,to_member,from_member,points,reason,created_at';

const clamp = (n: number) => Math.max(-METER_MAX, Math.min(METER_MAX, n));

/** Someone's score now: their points in order, never going past ±10 (extra points at the top do nothing). */
export function scoreOf(points: MeterPoint[], memberId: string): number {
  return points
    .filter((p) => p.to_member === memberId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .reduce((s, p) => clamp(s + p.points), 0);
}

/** How many points can still be given that way (+) or taken (−) before hitting the end of the dial. */
export function roomFor(score: number, sign: 1 | -1): number {
  return sign > 0 ? METER_MAX - score : score + METER_MAX;
}

export type MeterLook = 'boy' | 'girl';
/** Which sheep each person is (saved in the household's settings; set on the Oviemeter). */
export function lookOf(settings: Record<string, unknown> | undefined | null, memberId: string, index: number): MeterLook {
  const looks = (settings?.meter_looks ?? {}) as Record<string, unknown>;
  const v = looks[memberId];
  return v === 'girl' || v === 'boy' ? v : index % 2 === 0 ? 'boy' : 'girl';
}

/** Angel, devil or in between, for the sheep and the words under the dial. */
export function standing(score: number): { kind: 'angel' | 'devil' | 'even'; label: string } {
  if (score >= 8) return { kind: 'angel', label: 'Total angel' };
  if (score >= 4) return { kind: 'angel', label: 'Angel' };
  if (score > 0) return { kind: 'angel', label: 'Little angel' };
  if (score === 0) return { kind: 'even', label: 'Even' };
  if (score > -4) return { kind: 'devil', label: 'Little devil' };
  if (score > -8) return { kind: 'devil', label: 'Devil' };
  return { kind: 'devil', label: 'Total devil' };
}

/** "+3" / "−2" / "0" */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
