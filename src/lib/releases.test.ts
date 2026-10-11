import { episodeRelease, nextOutEpisode, upcomingReleases } from './releases';

const show = (over = {}) => ({ id: 's', name: 'The Series', kind: 'show', seasons: [10, 8], release_season: 2, release_episode: 3, release_on: '2026-10-15', release_pace: 'weekly', ...over });
const today = '2026-10-11';

describe('episode release dates', () => {
  it('no date means it is out', () => {
    expect(episodeRelease(show({ release_on: null, release_season: null, release_episode: null }), 2, 5, today)).toEqual({ out: true, on: null });
  });
  it('earlier episodes are out; weekly ones come one a week', () => {
    expect(episodeRelease(show(), 2, 2, today).out).toBe(true);
    expect(episodeRelease(show(), 1, 10, today).out).toBe(true);
    expect(episodeRelease(show(), 2, 3, today)).toEqual({ out: false, on: '2026-10-15' });
    expect(episodeRelease(show(), 2, 5, today)).toEqual({ out: false, on: '2026-10-29' });
  });
  it('every Thursday and Friday (The Traitors)', () => {
    // Thu 15 Oct 2026 is episode 5; then Fri 16, Thu 22, Fri 23 …
    const traitors = show({ seasons: [12], release_season: 1, release_episode: 5, release_on: '2026-10-15', release_days: [4, 5] });
    expect(['2026-10-15', '2026-10-16'].map((d) => new Date(`${d}T00:00`).getDay())).toEqual([4, 5]);
    expect([5, 6, 7, 8].map((e) => episodeRelease(traitors, 1, e, today).on)).toEqual(['2026-10-15', '2026-10-16', '2026-10-22', '2026-10-23']);
  });
  it('all at once: the rest of the season drops on the day', () => {
    expect(episodeRelease(show({ release_pace: 'all' }), 2, 8, today)).toEqual({ out: false, on: '2026-10-15' });
    expect(episodeRelease(show({ release_pace: 'all' }), 2, 8, '2026-10-15').out).toBe(true);
  });
  it('later seasons are not out until a date is set', () => {
    expect(episodeRelease(show({ seasons: [10, 8, 6] }), 3, 1, '2027-06-01')).toEqual({ out: false, on: null });
  });
  it('films: out on the day', () => {
    const film = { kind: 'film', release_season: null, release_episode: null, release_on: '2026-11-01', release_pace: 'all' };
    expect(episodeRelease(film, 0, 0, today)).toEqual({ out: false, on: '2026-11-01' });
    expect(episodeRelease(film, 0, 0, '2026-11-01').out).toBe(true);
  });
  it("never suggests an episode that isn't out", () => {
    const watched = [...Array.from({ length: 10 }, (_, i) => ({ season: 1, episode: i + 1 })), { season: 2, episode: 1 }, { season: 2, episode: 2 }];
    expect(nextOutEpisode(show(), watched, today)).toBeNull();
    expect(nextOutEpisode(show(), watched, '2026-10-15')).toEqual({ season: 2, episode: 3 });
  });
  it('counts down to the next new episode you have not seen', () => {
    const watched = [...Array.from({ length: 10 }, (_, i) => ({ season: 1, episode: i + 1 })), { season: 2, episode: 1 }, { season: 2, episode: 2 }];
    expect(upcomingReleases([show()], () => watched, today)).toEqual([{ id: 'rel-s', title: 'The Series S2 E3', day: '2026-10-15', days: 4 }]);
    expect(upcomingReleases([show()], () => [], today)).toEqual([]); // still catching up: S1 E1 is out
  });
});
