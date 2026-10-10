import { paidInSeries, spendingSeries, type TrendMonth } from './financeChart';

const trend: TrendMonth[] = [
  { month: '2026-08-01', spent: [{ group: 'RENT', total: 1420 }, { group: 'Groceries', total: 300 }], paid_in: [{ group: 'ANDREW', total: 1200 }, { group: 'PARKING', total: 100 }] },
  { month: '2026-09-01', spent: [{ group: 'Groceries', total: 250 }, { group: 'BILLS', total: 80 }], paid_in: [{ group: 'LINA', total: 600 }] },
];

describe('finance chart data', () => {
  it('gives each category a fixed colour that does not depend on its size or the month', () => {
    const { series, data } = spendingSeries(trend);
    expect(series.map((s) => [s.label, s.colour])).toEqual([
      ['Rent', 'var(--series-1)'], ['Groceries', 'var(--series-2)'], ['Bills', 'var(--series-3)'],
    ]);
    expect(data[1].values).toEqual({ GROCERIES: 250, BILLS: 80 });
  });

  it('folds more than six categories into Other', () => {
    const many: TrendMonth[] = [{ month: '2026-09-01', paid_in: [], spent: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'RENT'].map((g) => ({ group: g, total: 1 })) }];
    const { series, data } = spendingSeries(many);
    expect(series.length).toBeLessThanOrEqual(6);
    expect(Object.values(data[0].values).reduce((a, b) => a + b, 0)).toBe(8);
  });

  it('shows paid-in per person only (parking etc. left out)', () => {
    const { series, data } = paidInSeries(trend, ['ANDREW', 'LINA']);
    expect(series.map((s) => s.label)).toEqual(['Andrew', 'Lina']);
    expect(data[0].values).toEqual({ ANDREW: 1200 });
  });
});
