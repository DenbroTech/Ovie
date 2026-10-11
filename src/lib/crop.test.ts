import { clampCrop, defaultCrop, placeCrop, resizeCrop } from './crop';

describe('fit photo to the wall', () => {
  it('starts with the biggest 2:3 window in the middle', () => {
    const c = defaultCrop(1600, 1200); // landscape
    expect(c.h).toBe(1);
    expect(c.w * 1600 / (c.h * 1200)).toBeCloseTo(2 / 3);
    expect(c.x).toBeCloseTo((1 - c.w) / 2);
    const p = defaultCrop(1000, 2000); // tall portrait
    expect(p.w).toBe(1);
    expect(p.y).toBeGreaterThan(0);
  });
  it('keeps the window inside the picture', () => {
    expect(clampCrop({ x: 0.9, y: -0.2, w: 0.5, h: 0.5 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });
  it('resizes keeping the shape', () => {
    const c = resizeCrop(defaultCrop(1600, 1200), 0.2, 1600, 1200);
    expect((c.w * 1600) / (c.h * 1200)).toBeCloseTo(2 / 3);
    expect(c.w).toBeCloseTo(0.2);
  });
  it('places the picture so the chosen part fills the box', () => {
    // the left half of a 1600x1200 picture, shown in a 400x600 box
    const pos = placeCrop({ x: 0, y: 0, w: 0.5, h: 1 }, 1600, 1200, 400, 600);
    expect(pos.height).toBeCloseTo(600);
    expect(pos.left).toBe(0);
    // the right edge: the picture slides left, never leaving a gap
    const r = placeCrop({ x: 0.5, y: 0, w: 0.5, h: 1 }, 1600, 1200, 400, 600);
    expect(r.left).toBeCloseTo(400 - r.width);
  });
});
