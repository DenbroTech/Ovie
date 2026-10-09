import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { friendlyError } from './errors';
import { formatClock, greeting, hourIn } from './time';
import { applyTheme } from './theme';
import { initials } from '../ui/Avatar';

describe('readConfig', () => {
  it('accepts a Supabase URL and key', () => {
    expect(readConfig({ VITE_SUPABASE_URL: 'https://abc123.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toEqual({
      supabaseUrl: 'https://abc123.supabase.co',
      supabaseKey: 'sb_publishable_x',
    });
  });
  it('returns null when anything is missing or malformed', () => {
    expect(readConfig({})).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: 'http://evil.example', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull();
  });
});

describe('friendlyError', () => {
  it('explains network failures', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/can't reach/i);
  });
  it('explains a missing exposed schema', () => {
    expect(friendlyError({ code: 'PGRST106', message: 'The schema must be one of the following: public' })).toMatch(/Exposed schemas/);
  });
  it('explains permission errors and bad logins', () => {
    expect(friendlyError({ code: '42501', message: 'x' })).toMatch(/permission/);
    expect(friendlyError({ message: 'Invalid login credentials' })).toMatch(/don’t match/);
  });
  it('falls back to the message', () => {
    expect(friendlyError({ message: 'That invite code is not valid' })).toBe('That invite code is not valid');
    expect(friendlyError(null)).toBe('Something went wrong.');
  });
});

describe('time helpers', () => {
  const d = new Date('2026-10-09T21:30:00Z'); // 08:30 Fri 10 Oct in Sydney (AEDT, UTC+11)
  it('formats in the household time zone, not the device zone', () => {
    expect(hourIn(d, 'Australia/Sydney')).toBe(8);
    expect(hourIn(d, 'Europe/London')).toBe(22);
    expect(formatClock(d, 'Australia/Sydney')).toMatch(/^8:30/);
  });
  it('greets by time of day', () => {
    expect(greeting(3)).toBe('Good night');
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(13)).toBe('Good afternoon');
    expect(greeting(20)).toBe('Good evening');
  });
});

describe('applyTheme', () => {
  it('sets and clears the theme attribute and remembers it', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ovie.theme')).toBe('dark');
    applyTheme('system', root);
    expect(root.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('ovie.theme')).toBeNull();
  });
});

describe('initials', () => {
  it('takes first and last initials', () => {
    expect(initials('Andrew')).toBe('A');
    expect(initials('  sam  jo  lee ')).toBe('SL');
    expect(initials('')).toBe('?');
  });
});
