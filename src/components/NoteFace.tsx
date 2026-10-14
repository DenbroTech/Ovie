import { arrowHead, box, penPath, type Doodle, type DoodleItem } from '../lib/doodle';

/** One drawn item as SVG (face units 0–100). */
export function DoodleShape({ it }: { it: DoodleItem }) {
  const stroke = { stroke: it.c, strokeWidth: it.w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (it.k === 'pen') return <path d={penPath(it.p)} fill="none" {...stroke} />;
  if (it.k === 'line') return <line x1={it.p[0]} y1={it.p[1]} x2={it.p[2]} y2={it.p[3]} {...stroke} />;
  if (it.k === 'arrow') {
    return (
      <g fill="none" {...stroke}>
        <line x1={it.p[0]} y1={it.p[1]} x2={it.p[2]} y2={it.p[3]} />
        <path d={arrowHead(it.p[0], it.p[1], it.p[2], it.p[3], it.w)} />
      </g>
    );
  }
  const b = box(it.p);
  const fill = it.f ? it.c : 'none';
  if (it.k === 'rect') return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={1} fill={fill} {...stroke} />;
  return <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fill} {...stroke} />;
}

export function DoodleLayer({ doodle, extra }: { doodle: Doodle | null; extra?: DoodleItem | null }) {
  return (
    <svg className="note-doodle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {doodle?.items.map((it, i) => <DoodleShape key={i} it={it} />)}
      {extra && <DoodleShape it={extra} />}
    </svg>
  );
}

/** Text size steps with how much is written, so short notes are big. In face units (% of the width). */
export function faceTextSize(body: string, hasPicture: boolean): number {
  const n = body.trim().length;
  if (hasPicture) return n <= 30 ? 8 : n <= 80 ? 6.5 : 5;
  return n <= 20 ? 13 : n <= 50 ? 10 : n <= 110 ? 8 : n <= 220 ? 6.2 : 5;
}

/** The square face of a note with a picture, GIF or drawing: words on top, picture underneath, drawing over both.
 *  Everything is sized as a share of the note's width, so it looks the same (and the drawing lines up) at any size. */
export function NoteFace({ body, picture, doodle, children, className = '' }: {
  body: string; picture: string | null; doodle: Doodle | null; children?: React.ReactNode; className?: string;
}) {
  const size = faceTextSize(body, !!picture);
  return (
    <div className={`note-face ${className}`}>
      <div className="note-face-inner">
        {body.trim() && <p className="note-face-text" style={{ fontSize: `${size}cqw` }}>{body}</p>}
        {picture && <img className="note-face-pic" src={picture} alt="" draggable={false} />}
      </div>
      <DoodleLayer doodle={doodle} />
      {children}
    </div>
  );
}
