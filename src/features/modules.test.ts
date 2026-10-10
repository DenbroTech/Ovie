import { groupOpen, sortOpen, type Task } from './tasks/Tasks';
import { buyAgain, type Item } from './shopping/Shopping';
import { nice } from './finances/Finances';

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
