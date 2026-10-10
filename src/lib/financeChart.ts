import type { BarDatum, BarSeries } from '../components/charts/StackedBars';

export interface TrendMonth {
  month: string; // "YYYY-MM-01"
  spent: Array<{ group: string; total: number }>;
  paid_in: Array<{ group: string; total: number }>;
}

const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// Colour follows the category, never its size: a fixed slot per known ₲ryd group.
const FIXED = ['RENT', 'GROCERIES', 'BILLS', 'SHOP', 'OTHER'];
const MAX_SERIES = 6;

/** `exclude` leaves categories out (e.g. RENT on the screensaver). Colours stay fixed per category either way. */
export function spendingSeries(trend: TrendMonth[], exclude: string[] = []): { series: BarSeries[]; data: BarDatum[] } {
  const skip = new Set(exclude.map((e) => e.toUpperCase()));
  trend = trend.map((m) => ({ ...m, spent: m.spent.filter((g) => !skip.has(g.group.toUpperCase())) }));
  const seen = new Set<string>();
  for (const m of trend) for (const g of m.spent) seen.add(g.group.toUpperCase());
  const extra = [...seen].filter((g) => !FIXED.includes(g)).sort();
  const ordered = [...FIXED.filter((g) => seen.has(g)), ...extra];
  // past six categories, the rest fold into "Other" so no colour is invented
  const keep = ordered.slice(0, MAX_SERIES - (ordered.length > MAX_SERIES ? 1 : 0));
  const fold = (g: string) => (keep.includes(g) ? g : 'OTHER');
  const keys = [...new Set(ordered.map(fold))];
  const slotOf = (k: string) => {
    const i = FIXED.indexOf(k);
    return i >= 0 ? i + 1 : Math.min(MAX_SERIES, FIXED.length + 1 + extra.indexOf(k));
  };
  const series = keys.map((k) => ({ key: k, label: nice(k), colour: `var(--series-${slotOf(k)})` }));
  const data = trend.map((m) => {
    const values: Record<string, number> = {};
    for (const g of m.spent) {
      const k = fold(g.group.toUpperCase());
      values[k] = (values[k] ?? 0) + Number(g.total);
    }
    return { label: monthLabel(m.month), values };
  });
  return { series, data };
}

export function paidInSeries(trend: TrendMonth[], people: string[]): { series: BarSeries[]; data: BarDatum[] } {
  const names = people.map((p) => p.toUpperCase());
  const series = names.map((n, i) => ({ key: n, label: nice(n), colour: `var(--series-${Math.min(i + 1, MAX_SERIES)})` }));
  const data = trend.map((m) => {
    const values: Record<string, number> = {};
    for (const g of m.paid_in) if (names.includes(g.group.toUpperCase())) values[g.group.toUpperCase()] = Number(g.total);
    return { label: monthLabel(m.month), values };
  });
  return { series, data };
}

export function monthLabel(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00`).toLocaleDateString(undefined, { month: 'short' });
}

export interface MoneyGlance {
  spent: number;           // this month so far (excluded categories left out)
  usual: number | null;    // average of earlier months that had spending
  top: Array<{ label: string; total: number }>; // this month's biggest categories
}

/** A few big numbers for the wall screen instead of a chart: this month vs a usual month. */
export function moneyGlance(trend: TrendMonth[], exclude: string[] = []): MoneyGlance | null {
  if (!trend.length) return null;
  const skip = new Set(exclude.map((e) => e.toUpperCase()));
  const total = (m: TrendMonth) => m.spent.filter((g) => !skip.has(g.group.toUpperCase())).reduce((s, g) => s + Number(g.total), 0);
  const sorted = [...trend].sort((a, b) => a.month.localeCompare(b.month));
  const current = sorted[sorted.length - 1];
  const earlier = sorted.slice(0, -1).map(total).filter((t) => t > 0);
  const top = current.spent
    .filter((g) => !skip.has(g.group.toUpperCase()) && Number(g.total) > 0)
    .map((g) => ({ label: nice(g.group), total: Number(g.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  return {
    spent: total(current),
    usual: earlier.length ? earlier.reduce((s, t) => s + t, 0) / earlier.length : null,
    top,
  };
}
