import { notesForWall, postitColour, postitTilt } from './postits';

const n = (id: string, daysAgo: number, pinned = false) => ({ id, pinned, created_at: new Date(Date.UTC(2026, 9, 11) - daysAgo * 86_400_000).toISOString() });
const now = new Date(Date.UTC(2026, 9, 11));

describe('post-it notes', () => {
  it('shows up to 4 notes from the last 2 days', () => {
    const h = 1 / 24;
    expect(notesForWall([n('a', 0), n('b', 6 * h), n('c', 1), n('d', 1.5), n('e', 1.9)], now).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('always the 2 newest, however old', () => {
    expect(notesForWall([n('x', 10), n('y', 30), n('z', 40)], now).map((x) => x.id)).toEqual(['x', 'y']);
    expect(notesForWall([n('a', 1), n('old', 5), n('older', 9)], now).map((x) => x.id)).toEqual(['a', 'old']);
    expect(notesForWall([n('only', 20)], now).map((x) => x.id)).toEqual(['only']);
    expect(notesForWall([], now)).toEqual([]);
  });
  it('3 new ones: all 3, nothing older', () => {
    expect(notesForWall([n('a', 0), n('b', 1), n('c', 1.5), n('old', 3)], now).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('keeps pinned notes up even when old', () => {
    expect(notesForWall([n('p', 40, true), n('a', 1)], now).map((x) => x.id)).toEqual(['p', 'a']);
  });
  it('maps saved colours to pink, yellow, aqua and green', () => {
    expect(['sand', 'clay', 'sky', 'sage', 'plum'].map(postitColour)).toEqual(['yellow', 'pink', 'aqua', 'green', 'pink']);
  });
  it('tilts each note a little, always the same way', () => {
    const t = postitTilt('note-1');
    expect(postitTilt('note-1')).toBe(t);
    expect(Math.abs(t)).toBeGreaterThan(0);
    expect(Math.abs(t)).toBeLessThanOrEqual(3);
  });
});
