import { notesForWall, postitColour, postitTilt } from './postits';

const n = (id: string, daysAgo: number, pinned = false) => ({ id, pinned, created_at: new Date(Date.UTC(2026, 9, 11) - daysAgo * 86_400_000).toISOString() });
const now = new Date(Date.UTC(2026, 9, 11));

describe('post-it notes', () => {
  it('shows up to 4 notes from the last week', () => {
    expect(notesForWall([n('a', 0), n('b', 1), n('c', 2), n('d', 3), n('e', 4)], now).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(notesForWall([n('a', 1), n('old', 20)], now).map((x) => x.id)).toEqual(['a']);
  });
  it('just the newest one when everything is over a week old', () => {
    expect(notesForWall([n('x', 10), n('y', 30)], now).map((x) => x.id)).toEqual(['x']);
    expect(notesForWall([], now)).toEqual([]);
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
