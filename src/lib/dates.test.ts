import { addDays, dayLabel, expandEvents, nextEpisode, parseSeasons, repeatLabel, totalEpisodes, toIso } from './dates';

describe('dates', () => {
  it('labels days relative to today', () => {
    expect(dayLabel('2026-10-10', '2026-10-10')).toBe('Today');
    expect(dayLabel('2026-10-11', '2026-10-10')).toBe('Tomorrow');
    expect(dayLabel('2026-10-09', '2026-10-10')).toBe('Yesterday');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('describes repeats', () => {
    expect(repeatLabel(1, 'week')).toBe('Every week');
    expect(repeatLabel(2, 'week')).toBe('Every fortnight');
    expect(repeatLabel(3, 'day')).toBe('Every 3 days');
    expect(repeatLabel(null, null)).toBeNull();
  });
});

describe('expandEvents', () => {
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();

  it('repeats weekly inside the window only', () => {
    const occ = expandEvents([{ id: 'a', starts_at: at(2026, 9, 7, 18), ends_at: null, all_day: false, repeat: 'weekly' }], '2026-10-01', '2026-10-31');
    expect(occ.map((o) => o.day)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('keeps birthdays on the right day each year, including 29 Feb', () => {
    const occ = expandEvents([{ id: 'b', starts_at: at(2024, 2, 29, 0), ends_at: null, all_day: true, repeat: 'yearly' }], '2027-01-01', '2028-12-31');
    expect(occ.map((o) => o.day)).toEqual(['2027-02-28', '2028-02-29']);
  });

  it('moves the 31st to the end of shorter months', () => {
    const occ = expandEvents([{ id: 'c', starts_at: at(2026, 1, 31), ends_at: null, all_day: false, repeat: 'monthly' }], '2026-02-01', '2026-04-30');
    expect(occ.map((o) => o.day)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('includes one-off events and keeps duration', () => {
    const occ = expandEvents([{ id: 'd', starts_at: at(2026, 10, 12, 18), ends_at: at(2026, 10, 12, 19), all_day: false, repeat: 'none' }], '2026-10-12', '2026-10-12');
    expect(occ).toHaveLength(1);
    expect(occ[0].end!.getTime() - occ[0].start.getTime()).toBe(3_600_000);
    expect(toIso(occ[0].start)).toBe('2026-10-12');
  });
});

describe('watch progress', () => {
  it('finds the next episode after the furthest watched, across seasons', () => {
    expect(nextEpisode([3, 2], [])).toEqual({ season: 1, episode: 1 });
    expect(nextEpisode([3, 2], [{ season: 1, episode: 2 }])).toEqual({ season: 1, episode: 3 });
    expect(nextEpisode([3, 2], [{ season: 1, episode: 3 }])).toEqual({ season: 2, episode: 1 });
    expect(nextEpisode([3, 2], [{ season: 2, episode: 2 }])).toBeNull();
  });
  it('does not treat skipped episodes as watched', () => {
    // watched only S1E3: next is S2E1, and S1E1-2 stay unwatched
    expect(nextEpisode([3, 2], [{ season: 1, episode: 3 }])).toEqual({ season: 2, episode: 1 });
  });
  it('parses seasons', () => {
    expect(parseSeasons('10, 8 12')).toEqual([10, 8, 12]);
    expect(parseSeasons('')).toEqual([]);
    expect(parseSeasons('ten')).toBeNull();
    expect(totalEpisodes([10, 8])).toBe(18);
  });
});

import { repeatText } from './dates';
describe('repeat every N', () => {
  it('skips the weeks in between', () => {
    const occ = expandEvents([{ id: 'b', starts_at: new Date(2026, 9, 1, 9).toISOString(), ends_at: null, all_day: false, repeat: 'weekly', repeat_every: 2 }], '2026-10-01', '2026-11-12');
    expect(occ.map((o) => o.day)).toEqual(['2026-10-01', '2026-10-15', '2026-10-29', '2026-11-12']);
  });
  it('every 7 weeks, starting well before the window', () => {
    const occ = expandEvents([{ id: 'c', starts_at: new Date(2026, 0, 1, 9).toISOString(), ends_at: null, all_day: false, repeat: 'weekly', repeat_every: 7 }], '2026-10-01', '2026-12-31');
    expect(occ.map((o) => o.day)).toEqual(['2026-10-22', '2026-12-10']);
  });
  it('says how often', () => {
    expect(repeatText('weekly', 1)).toBe('Every week');
    expect(repeatText('weekly', 2)).toBe('Every 2 weeks');
    expect(repeatText('monthly', 3)).toBe('Every 3 months');
    expect(repeatText('none', 5)).toBe('Does not repeat');
  });
});

import { countdowns, occurrenceWhen } from './dates';
describe('events over several days', () => {
  const t = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  it('a weekend away shows on each of its days', () => {
    const ev = { id: 'w', starts_at: new Date(2026, 9, 16, 18).toISOString(), ends_at: new Date(2026, 9, 18, 14).toISOString(), all_day: false, repeat: 'none' as const };
    const occ = expandEvents([ev], '2026-10-15', '2026-10-20');
    expect(occ.map((o) => [o.day, o.dayIndex, o.days])).toEqual([['2026-10-16', 0, 3], ['2026-10-17', 1, 3], ['2026-10-18', 2, 3]]);
    expect(occ.map((o) => occurrenceWhen(o, t))).toEqual(['18:00 →', 'All day', 'until 14:00']);
  });
  it('an all-day holiday Mon-Fri (stored as ending at the start of Saturday)', () => {
    const ev = { id: 'h', starts_at: new Date(2026, 9, 19).toISOString(), ends_at: new Date(2026, 9, 24).toISOString(), all_day: true, repeat: 'none' as const };
    const occ = expandEvents([ev], '2026-10-19', '2026-10-31');
    expect(occ.map((o) => o.day)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    expect(occurrenceWhen(occ[2], t)).toBe('Day 3 of 5');
  });
  it('shows the days still to come when it started before the window', () => {
    const ev = { id: 'h', starts_at: new Date(2026, 9, 19).toISOString(), ends_at: new Date(2026, 9, 24).toISOString(), all_day: true, repeat: 'none' as const };
    expect(expandEvents([ev], '2026-10-22', '2026-10-31').map((o) => o.day)).toEqual(['2026-10-22', '2026-10-23']);
  });
  it('one-day events stay as they were', () => {
    const ev = { id: 'd', starts_at: new Date(2026, 9, 16, 9).toISOString(), ends_at: new Date(2026, 9, 16, 10).toISOString(), all_day: false, repeat: 'none' as const };
    const [o] = expandEvents([ev], '2026-10-16', '2026-10-16');
    expect(o.days).toBeUndefined();
  });
  it('no countdown to something already under way', () => {
    const ev = { id: 'h', starts_at: new Date(2026, 9, 15).toISOString(), ends_at: new Date(2026, 9, 20).toISOString(), all_day: true, repeat: 'none' as const };
    expect(countdowns([ev], '2026-10-16')).toEqual([]);
  });
});
