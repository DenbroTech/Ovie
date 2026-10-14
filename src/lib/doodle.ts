/** Finger drawings on notes: pen lines and shapes, kept as a small bit of JSON.
 *  Coordinates run 0–100 across and down the (square) face of the note, so a drawing lands
 *  in the same place on a phone, the PC and the wall screen. */

export type DoodleKind = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse';

export interface DoodleItem {
  k: DoodleKind;
  /** colour */
  c: string;
  /** line width, in face units */
  w: number;
  /** shapes only: filled in */
  f?: boolean;
  /** points as x,y,x,y… (shapes and lines: just the two corners / ends) */
  p: number[];
}

export interface Doodle { v: 1; items: DoodleItem[] }

export const DOODLE_COLOURS: Array<{ value: string; label: string }> = [
  { value: '#2a2622', label: 'Black' }, { value: '#e53935', label: 'Red' }, { value: '#1e66d0', label: 'Blue' },
  { value: '#2e9d4f', label: 'Green' }, { value: '#8e44ad', label: 'Purple' }, { value: '#ffffff', label: 'White' },
];
export const DOODLE_SIZES = [{ value: 1.2, label: 'Thin' }, { value: 2.8, label: 'Thick' }];
/** Keep drawings small enough for the database (it allows ~150 kB). */
export const MAX_POINTS = 12_000;

const r1 = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

export function emptyDoodle(): Doodle { return { v: 1, items: [] }; }

/** Is there anything drawn? (null and an empty drawing both count as nothing) */
export function hasDoodle(d: Doodle | null | undefined): d is Doodle {
  return !!d && Array.isArray(d.items) && d.items.length > 0;
}

/** Add a pen point unless it's too close to the last one (keeps the JSON small). */
export function addPoint(p: number[], x: number, y: number, minGap = 0.4): number[] {
  const n = p.length;
  if (n >= 2 && Math.hypot(p[n - 2] - x, p[n - 1] - y) < minGap) return p;
  return [...p, r1(x), r1(y)];
}

export function countPoints(d: Doodle): number {
  return d.items.reduce((s, it) => s + it.p.length / 2, 0);
}

/** A smooth SVG path through pen points (quadratic curves between midpoints). */
export function penPath(p: number[]): string {
  if (p.length < 2) return '';
  if (p.length === 2) return `M${p[0]} ${p[1]}l0.01 0`; // a dot
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += `Q${p[i]} ${p[i + 1]} ${r1(mx)} ${r1(my)}`;
  }
  return d + `L${p[p.length - 2]} ${p[p.length - 1]}`;
}

/** The two short strokes of an arrow head at (x2,y2). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(4, w * 3.2);
  const pt = (da: number) => `${r1(x2 - len * Math.cos(a - da))} ${r1(y2 - len * Math.sin(a - da))}`;
  return `M${pt(0.5)}L${x2} ${y2}L${pt(-0.5)}`;
}

/** Corners → a box (x, y, width, height) whichever way it was dragged. */
export function box(p: number[]): { x: number; y: number; w: number; h: number } {
  const [x1, y1, x2 = x1, y2 = y1] = p;
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Does a touch at (x, y) land on this item? Used by the rubber. */
export function hits(it: DoodleItem, x: number, y: number, slack = 3): boolean {
  const near = slack + it.w / 2;
  if (it.k === 'pen') {
    if (it.p.length === 2) return Math.hypot(it.p[0] - x, it.p[1] - y) <= near;
    for (let i = 0; i + 3 < it.p.length; i += 2) if (distToSegment(x, y, it.p[i], it.p[i + 1], it.p[i + 2], it.p[i + 3]) <= near) return true;
    return false;
  }
  if (it.k === 'line' || it.k === 'arrow') return distToSegment(x, y, it.p[0], it.p[1], it.p[2], it.p[3]) <= near;
  const b = box(it.p);
  if (it.k === 'rect') {
    const inside = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (it.f && inside) return true;
    const edges: Array<[number, number, number, number]> = [
      [b.x, b.y, b.x + b.w, b.y], [b.x + b.w, b.y, b.x + b.w, b.y + b.h], [b.x + b.w, b.y + b.h, b.x, b.y + b.h], [b.x, b.y + b.h, b.x, b.y]];
    return edges.some(([a, bb, c, d]) => distToSegment(x, y, a, bb, c, d) <= near);
  }
  // ellipse: normalised distance from the centre (1 = on the outline)
  const rx = Math.max(b.w / 2, 0.5), ry = Math.max(b.h / 2, 0.5);
  const cx = b.x + rx, cy = b.y + ry;
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  if (it.f && d <= 1) return true;
  return Math.abs(d - 1) * Math.min(rx, ry) <= near;
}

/** Read a drawing from the database, dropping anything malformed. */
export function parseDoodle(raw: unknown): Doodle | null {
  if (!raw || typeof raw !== 'object') return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const ok = items.filter((it): it is DoodleItem => !!it && typeof it === 'object'
    && ['pen', 'line', 'arrow', 'rect', 'ellipse'].includes((it as DoodleItem).k)
    && typeof (it as DoodleItem).c === 'string' && /^#[0-9a-f]{6}$/i.test((it as DoodleItem).c)
    && typeof (it as DoodleItem).w === 'number'
    && Array.isArray((it as DoodleItem).p) && (it as DoodleItem).p.length >= 2 && (it as DoodleItem).p.every((n) => typeof n === 'number'));
  return { v: 1, items: ok };
}
