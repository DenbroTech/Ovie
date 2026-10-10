import { useEffect, useRef, useState } from 'react';

export interface BarSeries { key: string; label: string; colour: string }
export interface BarDatum { label: string; values: Record<string, number> }

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const short = (n: number): string => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);

/**
 * Stacked (or grouped) bars. One y-axis, recessive grid, 2px gaps between segments,
 * totals on top, legend always shown for 2+ series, per-segment hover/tap tooltip.
 */
export function StackedBars({
  data, series, mode = 'stacked', height = 220, compact = false, ariaLabel,
}: {
  data: BarDatum[];
  series: BarSeries[];
  mode?: 'stacked' | 'grouped';
  height?: number;
  compact?: boolean;
  ariaLabel: string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  // Draw at the real width so labels stay a readable size on phones (no scaling down).
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const pad = { l: compact ? 6 : 44, r: 6, t: compact ? 18 : 22, b: 24 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const totals = data.map((d) => series.reduce((a, s) => a + Math.max(0, d.values[s.key] ?? 0), 0));
  const peak = mode === 'stacked' ? Math.max(...totals, 0) : Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const max = niceMax(peak);
  const y = (v: number) => (v / max) * plotH;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(64, slot * 0.62);
  const ticks = compact ? [] : [0, max / 2, max];

  return (
    <div className="chart" ref={box} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="chart-svg" onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH - y(t)} y2={pad.t + plotH - y(t)} className="chart-grid" />
            <text x={pad.l - 6} y={pad.t + plotH - y(t) + 4} textAnchor="end" className="chart-axis">{short(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          let acc = 0;
          const segs = mode === 'stacked'
            ? series.filter((s) => (d.values[s.key] ?? 0) > 0).map((s) => {
                const v = d.values[s.key];
                const h = y(v);
                const top = pad.t + plotH - y(acc) - h;
                acc += v;
                return { s, v, x: cx - barW / 2, w: barW, top, h };
              })
            : series.map((s, si) => {
                const v = Math.max(0, d.values[s.key] ?? 0);
                const w = (barW - 2 * (series.length - 1)) / series.length;
                const h = y(v);
                return { s, v, x: cx - barW / 2 + si * (w + 2), w, top: pad.t + plotH - h, h };
              });
          const lastIdx = segs.length - 1;
          return (
            <g key={d.label}>
              {segs.map((g, gi) => {
                const isTop = mode === 'grouped' || gi === lastIdx;
                const r = isTop ? Math.min(4, g.h / 2, g.w / 2) : 0;
                // 2px surface gap at the top of every stacked segment that has another segment above it
                const gap = mode === 'stacked' && gi < lastIdx ? Math.min(2, g.h / 2) : 0;
                const path = r > 0
                  ? `M${g.x},${g.top + g.h} V${g.top + r} Q${g.x},${g.top} ${g.x + r},${g.top} H${g.x + g.w - r} Q${g.x + g.w},${g.top} ${g.x + g.w},${g.top + r} V${g.top + g.h} Z`
                  : undefined;
                const text = `${d.label} · ${g.s.label}: ${short(g.v)}`;
                const show = (e: React.MouseEvent | React.FocusEvent) => {
                  const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
                  setTip({ x: ((g.x + g.w / 2) / W) * box.width, y: (g.top / H) * box.height, text });
                };
                return path ? (
                  <path key={g.s.key} d={path} fill={g.s.colour} tabIndex={compact ? -1 : 0} aria-label={text}
                    onMouseEnter={show} onFocus={show} onClick={show} />
                ) : (
                  <rect key={g.s.key} x={g.x} y={g.top + gap} width={g.w} height={Math.max(0, g.h - gap)} fill={g.s.colour}
                    tabIndex={compact ? -1 : 0} aria-label={text} onMouseEnter={show} onFocus={show} onClick={show} />
                );
              })}
              {mode === 'stacked' && totals[i] > 0 && (
                <text x={cx} y={pad.t + plotH - y(totals[i]) - 6} textAnchor="middle" className="chart-total">{short(totals[i])}</text>
              )}
              <text x={cx} y={H - 6} textAnchor="middle" className="chart-axis">{d.label}</text>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} className="chart-baseline" />
      </svg>
      {tip && !compact && (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">{tip.text}</div>
      )}
      {series.length >= 2 && (
        <ul className="chart-legend" aria-label="Legend">
          {series.map((s) => <li key={s.key}><i style={{ background: s.colour }} />{s.label}</li>)}
        </ul>
      )}
    </div>
  );
}
