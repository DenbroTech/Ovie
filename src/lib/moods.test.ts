import { dayMood, notesMood, shoppingMood } from './moods';

describe("Ovie's moods", () => {
  it('celebrates birthdays, sleeps at night, otherwise happy', () => {
    expect(dayMood({ night: false, todayTitles: ['Dentist'] })).toBe('happy');
    expect(dayMood({ night: true, todayTitles: [] })).toBe('sleepy');
    expect(dayMood({ night: true, todayTitles: ["Mum's birthday"] })).toBe('celebrating');
  });
  it('notes: surprised by a new note, in love when one is for you', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    const note = (o: object) => ({ from_member: 'lina', to_member: null, created_at: '2026-10-10T10:00:00Z', ...o });
    expect(notesMood([note({ created_at: '2026-10-11T09:30:00Z' })], 'me', now)).toBe('surprised');
    expect(notesMood([note({ to_member: 'me' })], 'me', now)).toBe('in-love');
    expect(notesMood([note({})], 'me', now)).toBe('thinking');
    expect(notesMood([note({ from_member: 'me', created_at: '2026-10-11T09:30:00Z' })], 'me', now)).toBe('thinking');
  });
  it('hungry when the shopping list is long', () => {
    expect(shoppingMood(3)).toBe('shopping');
    expect(shoppingMood(12)).toBe('hungry');
  });
});
