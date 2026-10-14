import { describe, expect, it } from 'vitest';
import { activityItems, describe as say, unreadCount, type ActivityRow } from './activity';

let n = 0;
const row = (over: Partial<ActivityRow>): ActivityRow => ({
  id: ++n, actor_user: 'u-lina', actor_member: 'm-l', actor_device: 'd-l', kind: 'task', action: 'added',
  ref_id: 'r' + n, title: 'Bins out', info: null, created_at: '2026-10-14T08:00:00Z', ...over,
});
const opts = {
  myUserId: 'u-me', meId: 'm-a', seenAt: '2026-10-14T07:00:00Z', timeZone: 'Australia/Sydney',
  memberName: (id: string | null) => (id === 'm-l' ? { name: 'Lina', colour: 'rose' } : null),
  deviceName: (id: string | null) => (id === 'd-wall' ? 'The wall screen' : null),
};

describe('what’s new', () => {
  it('says who did what', () => {
    const [it1] = activityItems([row({ kind: 'shopping', title: 'Milk' })], opts);
    expect(it1.who).toBe('Lina');
    expect(it1.text).toBe('added Milk to the shopping');
    expect(it1.path).toBe('/shopping');
    expect(it1.unread).toBe(true);
  });
  it('groups a burst of shopping by the same person into one line', () => {
    const rows = [
      row({ kind: 'shopping', title: 'Milk', created_at: '2026-10-14T08:05:00Z' }),
      row({ kind: 'shopping', title: 'Eggs', created_at: '2026-10-14T08:04:00Z' }),
      row({ kind: 'shopping', title: 'Bread', created_at: '2026-10-14T08:03:00Z' }),
      row({ kind: 'shopping', title: 'Jam', created_at: '2026-10-14T08:02:00Z' }),
    ];
    const items = activityItems(rows, opts);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('added Milk, Eggs and 2 more to the shopping');
  });
  it('does not count my own changes as new, and names the wall screen', () => {
    const rows = [row({ actor_user: 'u-me', actor_member: 'm-a' }), row({ actor_user: 'u-wall', actor_member: null, actor_device: 'd-wall' })];
    expect(unreadCount(rows, 'u-me', opts.seenAt)).toBe(1);
    const items = activityItems(rows, opts);
    expect(items[0].who).toBe('You');
    expect(items[0].unread).toBe(false);
    expect(items[1].who).toBe('The wall screen');
  });
  it('only counts what came after I last looked', () => {
    expect(unreadCount([row({ created_at: '2026-10-14T06:00:00Z' })], 'u-me', opts.seenAt)).toBe(0);
  });
  it('words notes, the calendar and shows', () => {
    expect(say([row({ kind: 'note', title: 'Gone to the gym', info: { to_member: 'm-a' } })], 'm-a')).toBe('left you a note: “Gone to the gym”');
    expect(say([row({ kind: 'note', title: '', info: { picture: true } })], 'm-a')).toBe('left a note with a picture');
    expect(say([row({ kind: 'task', action: 'done' })], null)).toBe('ticked off “Bins out”');
    expect(say([row({ kind: 'viewing', action: 'done', title: 'The Traitors', info: { season: 3, episode: 4 } })], null)).toBe('watched “The Traitors” S3 E4');
    expect(say([row({ kind: 'event', title: 'Dentist', info: { starts_at: '2026-10-17T22:00:00Z' } })], null, 'Australia/Sydney')).toMatch(/^added “Dentist” to the calendar · Sun/);
  });
});
