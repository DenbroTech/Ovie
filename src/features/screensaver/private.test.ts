import { describe, expect, it } from 'vitest';
import source from './Screensaver.tsx?raw';

describe('screensaver stays private', () => {
  it('never shows What’s new, or the reasons behind Oviemeter points', () => {
    expect(source).not.toMatch(/from\('activity'\)|ActivityBell|useActivity|\.reason\b/);
  });
});
