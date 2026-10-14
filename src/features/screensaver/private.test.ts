import { describe, expect, it } from 'vitest';
import source from './Screensaver.tsx?raw';

describe('screensaver stays private', () => {
  it('never shows the Oviemeter or What’s new', () => {
    expect(source).not.toMatch(/meter_points|from\('activity'\)|Oviemeter|MeterSheep|MeterGauge|ActivityBell|useActivity/);
  });
});
