import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { LoadError, Spinner } from '../../components/States';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { money, parseIso, toIso } from '../../lib/dates';
import { StackedBars } from '../../components/charts/StackedBars';
import { monthLabel, paidInSeries, spendingSeries, type TrendMonth } from '../../lib/financeChart';

export interface CasaSummary {
  month: string;
  spent: number;
  by_group: Array<{ group: string; total: number }>;
  paid_in: Array<{ group: string; total: number }>;
  people: Array<{ name: string; share: number }>;
  recent: Array<{ date: string; amount: number; group: string; direction: 'IN' | 'OUT'; merchant: string | null }>;
}

/** "GROCERIES" / "Groceries" → "Groceries" */
export const nice = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

export function FinancesScreen() {
  const [month, setMonth] = useState(() => { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 1)); });
  const [data, setData] = useState<CasaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendMonth[] | null>(null);
  const [asTable, setAsTable] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data: res, error: err } = await supabase.rpc('casa_summary', { p_month: month });
    if (err) { setError(`Couldn't read the house money from ₲ryd. ${friendlyError(err)}`); setData(null); return; }
    setData(res as CasaSummary);
    const t = await supabase.rpc('casa_trend', { p_months: 6 });
    setTrend(t.error ? null : (t.data as TrendMonth[]));
  }, [month]);

  useEffect(() => { setData(null); void load(); }, [load]);
  // ₲ryd changes don't reach Ovie's live updates, so refresh every few minutes while open.
  useEffect(() => { const id = window.setInterval(() => void load(), 5 * 60 * 1000); return () => window.clearInterval(id); }, [load]);

  const shift = (n: number) => { const d = parseIso(month); setMonth(toIso(new Date(d.getFullYear(), d.getMonth() + n, 1))); };
  const isThisMonth = month.slice(0, 7) === toIso(new Date()).slice(0, 7);
  const label = parseIso(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const max = Math.max(1, ...(data?.by_group.map((g) => Number(g.total)) ?? [1]));

  return (
    <Screen title="Finances">
      <div className="module">
        <div className="month-head">
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={26} /></button>
          <h3>{label}</h3>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Next month" disabled={isThisMonth} onClick={() => shift(1)}><ChevronRight size={26} /></button>
        </div>

        {error ? <LoadError message={error} onRetry={() => void load()} />
          : !data ? <Spinner /> : (
            <div className="fin">
              <section className="card fin-total">
                <span className="muted">House spending{isThisMonth ? ' so far' : ''}</span>
                <strong>{money(Number(data.spent))}</strong>
              </section>

              <section className="card">
                <h2>Where it went</h2>
                {data.by_group.length === 0 ? <p className="muted">No spending recorded this month.</p> : (
                  <ul className="bars">
                    {data.by_group.map((g) => (
                      <li key={g.group} className="bar-row">
                        <span className="bar-name">{nice(g.group)}</span>
                        <span className="bar-track"><span className="bar-fill" style={{ width: `${(Number(g.total) / max) * 100}%` }} /></span>
                        <span className="bar-amt">{money(Number(g.total))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {trend && trend.length > 0 && (
                <section className="card">
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--s-3)' }}>
                    <h2 style={{ margin: 0 }}>Last 6 months</h2>
                    <button type="button" className="btn btn-ghost" onClick={() => setAsTable((v) => !v)}>
                      {asTable ? 'Show charts' : 'Show as table'}
                    </button>
                  </div>
                  {asTable ? <TrendTable trend={trend} people={data.people.map((p) => p.name)} /> : (
                    <>
                      <h3 className="chart-title">House spending by category</h3>
                      {(() => { const s = spendingSeries(trend); return <StackedBars data={s.data} series={s.series} ariaLabel="House spending per month by category" />; })()}
                      <h3 className="chart-title">Paid in, by person</h3>
                      {(() => { const s = paidInSeries(trend, data.people.map((p) => p.name)); return <StackedBars data={s.data} series={s.series} mode="grouped" height={180} ariaLabel="Money paid in per month by person" />; })()}
                    </>
                  )}
                </section>
              )}

              <section className="card">
                <h2>Paid in</h2>
                {data.paid_in.length === 0 ? <p className="muted">Nothing paid in this month.</p> : (
                  <ul className="kv">
                    {data.paid_in.map((p) => {
                      const person = data.people.find((x) => x.name.toUpperCase() === p.group.toUpperCase());
                      return (
                        <li key={p.group}>
                          <span>{nice(p.group)}{person ? <span className="muted small"> · pays {Math.round(Number(person.share) * 100)}%</span> : null}</span>
                          <strong>{money(Number(p.total))}</strong>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card">
                <h2>Recent</h2>
                <ul className="kv">
                  {data.recent.map((r, i) => (
                    <li key={i}>
                      <span>
                        {r.merchant ? nice(r.merchant) : nice(r.group)}
                        <span className="muted small"> · {nice(r.group)} · {parseIso(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                      </span>
                      <strong className={r.direction === 'IN' ? 'fin-in' : undefined}>{r.direction === 'IN' ? '+' : ''}{money(Math.abs(Number(r.amount)))}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="muted small fin-note"><Lock size={14} /> Read-only, from ₲ryd's house account. Change things in ₲ryd.</p>
            </div>
          )}
      </div>
    </Screen>
  );
}

function TrendTable({ trend, people }: { trend: TrendMonth[]; people: string[] }) {
  const sp = spendingSeries(trend);
  const pi = paidInSeries(trend, people);
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th scope="col">Month</th>{sp.series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}<th scope="col">Spent</th>{pi.series.map((s) => <th key={s.key} scope="col">{s.label} paid</th>)}</tr>
        </thead>
        <tbody>
          {trend.map((m, i) => {
            const total = Object.values(sp.data[i].values).reduce((a, b) => a + b, 0);
            return (
              <tr key={m.month}>
                <th scope="row">{monthLabel(m.month)}</th>
                {sp.series.map((s) => <td key={s.key}>{sp.data[i].values[s.key] ? money(sp.data[i].values[s.key]) : '–'}</td>)}
                <td><strong>{money(total)}</strong></td>
                {pi.series.map((s) => <td key={s.key}>{pi.data[i].values[s.key] ? money(pi.data[i].values[s.key]) : '–'}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
