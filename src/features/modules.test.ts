import { groupOpen, sortOpen, type Task } from './tasks/Tasks';
import { buyAgain, type Item } from './shopping/Shopping';
import { nice } from './finances/Finances';
import { sortNotes, type Note } from './notes/Notes';

vi.mock('../lib/supabase', () => ({ supabase: {}, configError: null }));

const task = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36), household_id: 'h', title: 't', notes: null, assignee_id: null, priority: 0,
  due_on: null, repeat_every: null, repeat_unit: null, completed_at: null, completed_by: null, created_at: '2026-10-01T00:00:00Z', ...over,
});

describe('tasks', () => {
  it('groups open tasks: overdue, today, upcoming, anytime', () => {
    const groups = groupOpen([
      task({ title: 'later', due_on: '2026-10-20' }),
      task({ title: 'whenever' }),
      task({ title: 'late', due_on: '2026-10-01' }),
      task({ title: 'now', due_on: '2026-10-10' }),
    ], '2026-10-10');
    expect(groups.map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
      ['Overdue', ['late']], ['Today', ['now']], ['Upcoming', ['later']], ['Anytime', ['whenever']],
    ]);
  });
  it('puts important tasks first within the same day', () => {
    const sorted = sortOpen([task({ title: 'a', due_on: '2026-10-10' }), task({ title: 'b', due_on: '2026-10-10', priority: 1 })]);
    expect(sorted.map((t) => t.title)).toEqual(['b', 'a']);
  });
});

const item = (over: Partial<Item>): Item => ({
  id: Math.random().toString(36), list_id: 'g', name: 'x', qty: null, note: null, checked_at: null, cleared_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
});

describe('shopping: buy again', () => {
  it('suggests past items most-bought first, skipping what is already on the list and other lists', () => {
    const items = [
      item({ name: 'Eggs', cleared_at: 'x' }), item({ name: 'eggs ', cleared_at: 'x' }), item({ name: 'Eggs', cleared_at: 'x' }),
      item({ name: 'Bread', cleared_at: 'x' }),
      item({ name: 'Milk', cleared_at: 'x' }), item({ name: 'milk' }),          // milk is on the list now
      item({ name: 'Screws', cleared_at: 'x', list_id: 'hardware' }),         // other list
    ];
    expect(buyAgain(items, 'g')).toEqual(['Eggs', 'Bread']);
  });
});

describe('finances', () => {
  it('tidies ₲ryd group names', () => {
    expect(nice('GROCERIES')).toBe('Groceries');
    expect(nice('Groceries')).toBe('Groceries');
    expect(nice(null)).toBe('');
  });
});

describe('notes', () => {
  const note = (over: Partial<Note>): Note => ({ id: Math.random().toString(36), body: 'x', from_member: null, to_member: null, colour: 'sand', pinned: false, done_at: null, created_at: '2026-10-01T00:00:00Z', ...over });
  it('shows pinned notes first, then newest', () => {
    const sorted = sortNotes([
      note({ body: 'old', created_at: '2026-10-01T00:00:00Z' }),
      note({ body: 'new', created_at: '2026-10-09T00:00:00Z' }),
      note({ body: 'pinned', pinned: true, created_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(sorted.map((n) => n.body)).toEqual(['pinned', 'new', 'old']);
  });
});

import { slidesToShow } from './screensaver/Screensaver';
describe('screensaver slides', () => {
  it('one big panel: today first, and skips empty topics', () => {
    expect(slidesToShow({ jobs: true, countdown: true, shopping: true, money: false, watch: true })).toEqual(['today', 'jobs', 'countdown', 'shopping', 'watch']);
    expect(slidesToShow({})).toEqual(['today']);
  });
});

import { finishedMonths } from '../lib/financeChart';
import { countdowns } from '../lib/dates';
describe('screensaver: money month by month', () => {
  const trend = [
    { month: '2026-07-01', spent: [{ group: 'RENT', total: 1420 }, { group: 'GROCERIES', total: 500 }], paid_in: [] },
    { month: '2026-08-01', spent: [{ group: 'RENT', total: 1420 }, { group: 'GROCERIES', total: 600 }, { group: 'BILLS', total: 200 }], paid_in: [] },
    { month: '2026-09-01', spent: [{ group: 'RENT', total: 1420 }, { group: 'GROCERIES', total: 650 }, { group: 'BILLS', total: 100 }], paid_in: [] },
    { month: '2026-10-01', spent: [{ group: 'GROCERIES', total: 50 }], paid_in: [] },
  ];
  it('finished months only, rent left out, with the change from the month before', () => {
    const m = finishedMonths(trend, ['RENT'], '2026-10-11');
    expect(m.map((x) => [x.month, x.total, x.change])).toEqual([['2026-07-01', 500, null], ['2026-08-01', 800, 300], ['2026-09-01', 750, -50]]);
  });
  it('keeps the most recent few', () => {
    expect(finishedMonths(trend, ['RENT'], '2026-10-11', 2).map((x) => x.month)).toEqual(['2026-08-01', '2026-09-01']);
  });
});

describe('screensaver: countdowns', () => {
  const ev = (id: string, starts_at: string, repeat: 'none' | 'weekly' | 'yearly' = 'none') => ({ id, starts_at, ends_at: null, all_day: true, repeat });
  it('counts down to the next special things, skipping weekly ones and today', () => {
    const c = countdowns([ev('yoga', '2026-10-03T09:00:00', 'weekly'), ev('bday', '2025-10-16T00:00:00', 'yearly'), ev('trip', '2026-12-20T00:00:00'), ev('today', '2026-10-11T00:00:00')], '2026-10-11');
    expect(c.map((x) => [x.event.id, x.days])).toEqual([['bday', 5], ['trip', 70]]);
  });
});
