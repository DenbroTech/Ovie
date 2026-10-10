import { resolveTheme, applyTheme, storedTheme, isNight } from './theme';

describe('theme', () => {
  it('Automatic is dark at night, light in the day', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('knows when it is night in the home time zone, across midnight', () => {
    const s = { from: '19:00', until: '07:00', timeZone: 'Australia/Sydney' };
    // 2026-10-10 is AEDT (UTC+11)
    expect(isNight(new Date('2026-10-10T09:30:00Z'), s)).toBe(true);  // 8:30 pm Sydney
    expect(isNight(new Date('2026-10-10T15:00:00Z'), s)).toBe(true);  // 2 am
    expect(isNight(new Date('2026-10-10T20:30:00Z'), s)).toBe(false); // 7:30 am
    expect(isNight(new Date('2026-10-10T02:00:00Z'), s)).toBe(false); // 1 pm
    expect(isNight(new Date('2026-10-10T07:59:00Z'), s)).toBe(false); // 6:59 pm
    expect(isNight(new Date('2026-10-10T08:00:00Z'), s)).toBe(true);  // 7:00 pm
  });

  it('handles a daytime window and a zero-length window', () => {
    expect(isNight(new Date('2026-10-10T02:00:00Z'), { from: '12:00', until: '14:00', timeZone: 'Australia/Sydney' })).toBe(true);
    expect(isNight(new Date('2026-10-10T02:00:00Z'), { from: '07:00', until: '07:00', timeZone: 'Australia/Sydney' })).toBe(false);
  });
  it('applies and remembers a choice', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(storedTheme()).toBe('dark');
  });
});
