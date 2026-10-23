import { describe, expect, it } from 'vitest';
import { canWish, sortWishes, timeLeft, wishPointsFree, type Wish } from './genie';

const w = (o: Partial<Wish>): Wish => ({
  id: 'w', from_member: 'a', to_member: 'b', wish: 'x', created_at: '2026-10-20T00:00:00Z',
  due_at: '2026-10-23T00:00:00Z', granted_at: null, missed_at: null, ...o,
});

describe('genie', () => {
  it('needs 3 free points, counting wishes still waiting', () => {
    expect(canWish(2, [], 'a')).toBe(false);
    expect(canWish(3, [], 'a')).toBe(true);
    expect(wishPointsFree(5, [w({})], 'a')).toBe(2);
    expect(canWish(5, [w({})], 'a')).toBe(false);
    expect(canWish(6, [w({}), w({ granted_at: '2026-10-21T00:00:00Z' })], 'a')).toBe(true);
    expect(canWish(3, [w({ from_member: 'b', to_member: 'a' })], 'a')).toBe(true);
  });
  it('says how long is left', () => {
    const now = new Date('2026-10-20T00:00:00Z').getTime();
    expect(timeLeft('2026-10-23T00:00:00Z', now)).toBe('3 days left');
    expect(timeLeft('2026-10-21T05:30:00Z', now)).toBe('1 day 5 h left');
    expect(timeLeft('2026-10-20T03:00:00Z', now)).toBe('3 h left');
    expect(timeLeft('2026-10-20T00:40:00Z', now)).toBe('40 min left');
    expect(timeLeft('2026-10-19T23:00:00Z', now)).toBe("Time's up");
  });
  it('puts waiting wishes first, soonest due', () => {
    const list = sortWishes([
      w({ id: 'done', granted_at: '2026-10-21T00:00:00Z' }),
      w({ id: 'late', due_at: '2026-10-25T00:00:00Z' }),
      w({ id: 'soon', due_at: '2026-10-22T00:00:00Z' }),
    ]);
    expect(list.map((x) => x.id)).toEqual(['soon', 'late', 'done']);
  });
});
