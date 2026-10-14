import { sheepSrc, type SheepMood } from '../../components/OvieSheep';
import { METER_MAX, standing, type MeterLook } from '../../lib/meter';

function moodFor(score: number): SheepMood {
  if (score >= 8) return 'excited';
  if (score >= 0) return 'happy';
  if (score > -4) return 'silly';
  return 'angry';
}

/** Ovie as this person: a boy sheep (blue bow tie) or girl sheep (pink bow), with a halo and wings when they've
 *  been good, horns and a tail when they've been bad. Drawn over the normal sheep picture. */
export function MeterSheep({ score, look, size = 150 }: { score: number; look: MeterLook; size?: number }) {
  const s = standing(score).kind;
  return (
    <svg className="meter-sheep" width={size} height={size * (330 / 356)} viewBox="-50 -50 356 330" role="img"
      aria-label={`${look === 'girl' ? 'Girl' : 'Boy'} sheep, ${standing(score).label.toLowerCase()}`}>
      {s === 'angel' && (
        <g className="meter-wings" fill="#ffffff" stroke="#c9c2b6" strokeWidth="4" strokeLinejoin="round">
          <path d="M40 120 C -10 60, -48 70, -44 110 C -60 120, -50 140, -30 140 C -48 156, -30 176, -8 168 C -14 186, 10 196, 34 178 Z" />
          <path d="M216 120 C 266 60, 304 70, 300 110 C 316 120, 306 140, 286 140 C 304 156, 286 176, 264 168 C 270 186, 246 196, 222 178 Z" />
        </g>
      )}
      {s === 'devil' && (
        <path className="meter-tail" d="M210 205 C 260 225, 290 200, 282 160" fill="none" stroke="#d32f2f" strokeWidth="9" strokeLinecap="round" />
      )}
      {s === 'devil' && <path d="M282 140 L 268 168 L 296 166 Z" fill="#d32f2f" />}
      <image href={sheepSrc(moodFor(score))} x="0" y="0" width="256" height="256" />
      {s === 'angel' && (
        <ellipse cx="128" cy="-14" rx="62" ry="14" fill="none" stroke="#f5c242" strokeWidth="10" className="meter-halo" />
      )}
      {s === 'devil' && (
        <g fill="#d32f2f" stroke="#8e1b1b" strokeWidth="3" strokeLinejoin="round">
          <path d="M70 40 C 62 10, 50 -10, 34 -22 C 60 -14, 88 4, 98 30 Z" />
          <path d="M186 40 C 194 10, 206 -10, 222 -22 C 196 -14, 168 4, 158 30 Z" />
        </g>
      )}
      {look === 'girl' ? (
        <g transform="translate(46 62) rotate(-18)">
          <path d="M0 0 L -30 -18 L -30 18 Z" fill="#ff6fa8" stroke="#c2185b" strokeWidth="3" strokeLinejoin="round" />
          <path d="M0 0 L 30 -18 L 30 18 Z" fill="#ff6fa8" stroke="#c2185b" strokeWidth="3" strokeLinejoin="round" />
          <circle r="9" fill="#ff8fbf" stroke="#c2185b" strokeWidth="3" />
        </g>
      ) : (
        <g transform="translate(128 232)">
          <path d="M0 0 L -28 -15 L -28 15 Z" fill="#3a7bd5" stroke="#1f4e95" strokeWidth="3" strokeLinejoin="round" />
          <path d="M0 0 L 28 -15 L 28 15 Z" fill="#3a7bd5" stroke="#1f4e95" strokeWidth="3" strokeLinejoin="round" />
          <rect x="-7" y="-8" width="14" height="16" rx="4" fill="#5b95e6" stroke="#1f4e95" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

/** A speedometer from −10 (bad, red, left) to +10 (good, green, right) with a needle at the score. */
export function MeterGauge({ score, size = 220 }: { score: number; size?: number }) {
  const cx = 110, cy = 112, r = 88;
  const segs = 20;
  const pt = (deg: number, rad: number) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy - rad * Math.sin((deg * Math.PI) / 180)] as const;
  const colour = (t: number) => {
    // red → amber → green
    const stops = [[211, 47, 47], [245, 176, 65], [67, 160, 71]];
    const [a, b, u] = t < 0.5 ? [stops[0], stops[1], t / 0.5] : [stops[1], stops[2], (t - 0.5) / 0.5];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`;
  };
  const angle = 180 - ((score + METER_MAX) / (2 * METER_MAX)) * 180;
  return (
    <svg className="meter-gauge" width={size} height={size * (140 / 220)} viewBox="0 0 220 140" role="img" aria-label={`Score ${score} out of ${METER_MAX}`}>
      {Array.from({ length: segs }, (_, i) => {
        const a0 = 180 - (i / segs) * 180, a1 = 180 - ((i + 1) / segs) * 180 - 0.6;
        const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
        return <path key={i} d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={colour((i + 0.5) / segs)} strokeWidth="18" fill="none" />;
      })}
      {[-10, -5, 0, 5, 10].map((v) => {
        const a = 180 - ((v + METER_MAX) / (2 * METER_MAX)) * 180;
        const [x0, y0] = pt(a, r - 14), [x1, y1] = pt(a, r - 22), [tx, ty] = pt(a, r - 34);
        return (
          <g key={v}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="currentColor" strokeWidth="3" opacity="0.5" />
            {v % 10 === 0 && <text x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor" opacity="0.6">{v > 0 ? `+${v}` : v}</text>}
          </g>
        );
      })}
      <text x="12" y="134" fontSize="18" aria-hidden="true">😈</text>
      <text x="186" y="134" fontSize="18" aria-hidden="true">😇</text>
      <g className="meter-needle" style={{ transform: `rotate(${90 - angle}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <path d={`M${cx - 5} ${cy} L ${cx} ${cy - r + 8} L ${cx + 5} ${cy} Z`} fill="currentColor" />
      </g>
      <circle cx={cx} cy={cy} r="9" fill="currentColor" />
    </svg>
  );
}
