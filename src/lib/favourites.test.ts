import { eventsFor, findFavourite, timeText, withTime, type Favourite } from './favourites';

const fav: Favourite = { id: 'f', title: "Working at Harvey's", notes: null, location: "Harvey's", member_id: 'lina', all_day: false, times: [] };

describe('calendar favourites', () => {
  it('names a time nicely', () => {
    expect(timeText({ label: 'Early', from: '07:00', to: '15:00' })).toMatch(/^Early · 7:00\s?AM–3:00\s?PM$/i);
    expect(timeText({ label: '', from: '18:30', to: null })).toMatch(/^6:30\s?PM$/i);
  });
  it('adds times without duplicates', () => {
    const one = withTime([], { label: 'Early', from: '07:00', to: '15:00' });
    const two = withTime(one, { label: 'Late', from: '15:00', to: '23:00' });
    expect(withTime(two, { label: 'Early again', from: '07:00', to: '15:00' }).map((t) => t.label)).toEqual(['Late', 'Early again']);
  });
  it('finds a favourite by title, ignoring case', () => {
    expect(findFavourite([fav], "  working at HARVEY'S ")?.id).toBe('f');
    expect(findFavourite([fav], 'Dentist')).toBeNull();
  });
  it('puts a favourite on several days, each with its own time', () => {
    const rows = eventsFor(fav, {
      '2026-10-16': { label: 'Late', from: '15:00', to: '23:00' },
      '2026-10-15': { label: 'Early', from: '07:00', to: '15:00' },
      '2026-10-17': { label: 'Close', from: '18:00', to: '01:00' },
    }, 'h', 'me');
    expect(rows.map((r) => r.starts_at)).toEqual([
      new Date('2026-10-15T07:00').toISOString(), new Date('2026-10-16T15:00').toISOString(), new Date('2026-10-17T18:00').toISOString()]);
    expect(rows[0]).toMatchObject({ title: "Working at Harvey's", location: "Harvey's", member_id: 'lina', all_day: false });
    expect(rows[2].ends_at).toBe(new Date('2026-10-18T01:00').toISOString()); // past midnight
  });
  it('all-day picks have no time', () => {
    const [r] = eventsFor({ ...fav, all_day: true }, { '2026-10-15': null }, 'h', null);
    expect(r).toMatchObject({ all_day: true, starts_at: new Date('2026-10-15T00:00').toISOString(), ends_at: null });
  });
});
