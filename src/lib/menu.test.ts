import { eventWhenLabel, mealTitle, plannedByDay } from './menu';

describe('menu', () => {
  it('titles meals with their picture', () => {
    expect(mealTitle({ name: ' Pizza night ', emoji: '🍕' })).toBe('🍕 Pizza night');
    expect(mealTitle({ name: 'Leftovers', emoji: null })).toBe('Leftovers');
  });
  it('one meal per day, keyed by the local day', () => {
    const at = (d: string) => new Date(`${d}T00:00`).toISOString();
    const m = plannedByDay([
      { id: 'a', meal_id: 'm1', starts_at: at('2026-10-12'), title: 'Pizza' },
      { id: 'b', meal_id: 'm2', starts_at: at('2026-10-12'), title: 'Tacos' },
      { id: 'c', meal_id: 'm2', starts_at: at('2026-10-13'), title: 'Tacos' },
    ]);
    expect(Object.keys(m)).toEqual(['2026-10-12', '2026-10-13']);
    expect(m['2026-10-12'].id).toBe('a');
  });
  it('planned meals say "Dinner" instead of "All day"', () => {
    expect(eventWhenLabel({ all_day: true, meal_id: 'm' }, () => '6:00 PM')).toBe('Dinner');
    expect(eventWhenLabel({ all_day: true }, () => '6:00 PM')).toBe('All day');
    expect(eventWhenLabel({ all_day: false }, () => '6:00 PM')).toBe('6:00 PM');
  });
});
