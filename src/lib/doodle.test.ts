import { describe, expect, it } from 'vitest';
import { addPoint, box, hasDoodle, hits, parseDoodle, penPath, type DoodleItem } from './doodle';
import { gifFromLink, gifKeyFrom } from './gifs';

describe('doodle', () => {
  it('skips pen points that are too close together and keeps them on the note', () => {
    let p: number[] = [];
    p = addPoint(p, 10, 10);
    p = addPoint(p, 10.1, 10.1);
    p = addPoint(p, 120, -5);
    expect(p).toEqual([10, 10, 100, 0]);
  });
  it('draws a dot for a single tap and curves through points', () => {
    expect(penPath([5, 5])).toBe('M5 5l0.01 0');
    expect(penPath([0, 0, 10, 10, 20, 0])).toMatch(/^M0 0.*L20 0$/);
  });
  it('makes a box whichever way it was dragged', () => {
    expect(box([30, 40, 10, 5])).toEqual({ x: 10, y: 5, w: 20, h: 35 });
  });
  it('rubs out what is touched', () => {
    const line: DoodleItem = { k: 'line', c: '#000000', w: 1, p: [0, 0, 100, 100] };
    const ring: DoodleItem = { k: 'ellipse', c: '#000000', w: 1, p: [40, 40, 60, 60] };
    const blob: DoodleItem = { ...ring, f: true };
    expect(hits(line, 50, 51)).toBe(true);
    expect(hits(line, 80, 10)).toBe(false);
    expect(hits(ring, 50, 50)).toBe(false); // middle of an empty circle
    expect(hits(ring, 60, 50)).toBe(true); // its edge
    expect(hits(blob, 50, 50)).toBe(true); // filled in
  });
  it('reads drawings from the database safely', () => {
    expect(parseDoodle(null)).toBeNull();
    const d = parseDoodle({ v: 1, items: [{ k: 'pen', c: '#e53935', w: 1.2, p: [1, 2] }, { k: 'evil', c: 'x', w: 1, p: [] }, null] });
    expect(d?.items).toHaveLength(1);
    expect(hasDoodle(d)).toBe(true);
    expect(hasDoodle({ v: 1, items: [] })).toBe(false);
  });
});

describe('gifs', () => {
  it('turns a GIPHY page link into the GIF itself', () => {
    expect(gifFromLink('https://giphy.com/gifs/happy-dance-l0MYt5jPR6QX5pnqM')).toBe('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif');
    expect(gifFromLink('https://media2.giphy.com/media/abc123/giphy.gif?cid=1&rid=giphy.gif')).toBe('https://media2.giphy.com/media/abc123/giphy.gif?cid=1&rid=giphy.gif');
    expect(gifFromLink('https://example.com/cat.gif')).toBeNull();
  });
  it('reads the GIF key from household settings', () => {
    expect(gifKeyFrom({})).toBeNull();
    expect(gifKeyFrom({ gif_key: ' abc ' })).toEqual({ provider: 'giphy', key: 'abc' });
    expect(gifKeyFrom({ gif_key: 'k', gif_provider: 'klipy' })).toEqual({ provider: 'klipy', key: 'k' });
  });
});
