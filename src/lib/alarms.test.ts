import { daysLabel, lastOccurrence, nextOccurrence, ringingOccurrence, type AlarmLike } from './alarms';

const alarm = (over: Partial<AlarmLike>): AlarmLike => ({
  id: 'a', at_time: '19:00', days: [], on_date: null, enabled: true, last_dismissed_for: null, snoozed_until: null, ...over,
});
// Wednesday 14 October 2026
const wed = (h: number, m = 0) => new Date(2026, 9, 14, h, m);

describe('alarms', () => {
  it('rings on the right days at the right time', () => {
    const bins = alarm({ days: [3] }); // Wednesdays 7pm
    expect(ringingOccurrence(bins, wed(18, 59))).toBeNull();
    expect(ringingOccurrence(bins, wed(19, 0))?.getHours()).toBe(19);
    expect(ringingOccurrence(bins, wed(19, 10))).not.toBeNull();
  });

  it('stops by itself after 30 minutes', () => {
    expect(ringingOccurrence(alarm({ days: [3] }), wed(19, 31))).toBeNull();
  });

  it('stopping it on one screen stops it everywhere', () => {
    const stopped = alarm({ days: [3], last_dismissed_for: wed(19, 0).toISOString() });
    expect(ringingOccurrence(stopped, wed(19, 5))).toBeNull();
  });

  it('snooze silences it, then it rings again', () => {
    const snoozed = alarm({ days: [3], snoozed_until: wed(19, 9).toISOString() });
    expect(ringingOccurrence(snoozed, wed(19, 5))).toBeNull();
    expect(ringingOccurrence(snoozed, wed(19, 9))).not.toBeNull();
    expect(ringingOccurrence(snoozed, wed(19, 35))).not.toBeNull(); // 30 min counts from the snooze
  });

  it('one-off alarms ring once on their date', () => {
    const once = alarm({ on_date: '2026-10-14', at_time: '17:30' });
    expect(ringingOccurrence(once, wed(17, 31))).not.toBeNull();
    expect(lastOccurrence(once, new Date(2026, 9, 13, 18))).toBeNull();
  });

  it('switched-off alarms never ring', () => {
    expect(ringingOccurrence(alarm({ days: [3], enabled: false }), wed(19, 1))).toBeNull();
  });

  it('finds the next time it goes off', () => {
    const next = nextOccurrence(alarm({ days: [1, 5] }), wed(20)); // Mon & Fri
    expect(next?.getDay()).toBe(5);
    expect(next?.getDate()).toBe(16);
  });

  it('describes days', () => {
    expect(daysLabel([1, 2, 3, 4, 5], null)).toBe('Weekdays');
    expect(daysLabel([0, 6], null)).toBe('Weekends');
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6], null)).toBe('Every day');
    expect(daysLabel([3, 0], null)).toBe('Wed, Sun');
  });
});
