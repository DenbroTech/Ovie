import { greetingFor, initials, formatClock } from './time';

describe('time helpers', () => {
  it('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 0, 1, 13))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 0, 1, 20))).toBe('Good evening');
    expect(greetingFor(new Date(2026, 0, 1, 2))).toBe('Good night');
  });
  it('greets by the household time zone, not the device clock', () => {
    const d = new Date('2026-10-10T00:08:00Z'); // 11:08 am in Sydney, 00:08 in UTC
    expect(greetingFor(d, 'Australia/Sydney')).toBe('Good morning');
    expect(greetingFor(d, 'UTC')).toBe('Good night');
  });
  it('makes initials', () => {
    expect(initials('Andrew')).toBe('A');
    expect(initials('lina  maria gomez')).toBe('LG');
    expect(initials('  ')).toBe('?');
  });
  it('formats the clock in the household time zone', () => {
    const d = new Date('2026-10-09T22:00:00Z');
    const sydney = formatClock(d, 'Australia/Sydney');
    const london = formatClock(d, 'Europe/London');
    expect(sydney).not.toBe(london);
    expect(sydney).toMatch(/9:00/);
  });
});
