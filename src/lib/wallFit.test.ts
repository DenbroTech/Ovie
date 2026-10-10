import { wallZoom } from './wallFit';

describe('wallZoom', () => {
  it('leaves the real 1024x600 screen alone', () => expect(wallZoom(1024, 600)).toBe(1));
  it('scales a 1080p picture up so the layout matches the 7" screen', () => expect(wallZoom(1920, 1080)).toBe(1.8));
  it('scales 720p too', () => expect(wallZoom(1280, 720)).toBe(1.2));
  it('never shrinks', () => expect(wallZoom(800, 480)).toBe(1));
});
