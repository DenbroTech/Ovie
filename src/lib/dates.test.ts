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
