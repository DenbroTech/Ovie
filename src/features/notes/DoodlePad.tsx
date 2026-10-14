import { useRef, useState } from 'react';
import { ArrowUpRight, Circle, Eraser, Minus, PaintBucket, Pencil, Square, Trash2, Undo2 } from 'lucide-react';
import { DoodleShape, NoteFace } from '../../components/NoteFace';
import {
  addPoint, countPoints, DOODLE_COLOURS, DOODLE_SIZES, hits, MAX_POINTS, type Doodle, type DoodleItem, type DoodleKind,
} from '../../lib/doodle';

type Tool = DoodleKind | 'rubber';
const TOOLS: Array<{ value: Tool; label: string; icon: React.ReactNode }> = [
  { value: 'pen', label: 'Pen', icon: <Pencil size={20} /> },
  { value: 'line', label: 'Line', icon: <Minus size={20} /> },
  { value: 'arrow', label: 'Arrow', icon: <ArrowUpRight size={20} /> },
  { value: 'rect', label: 'Box', icon: <Square size={20} /> },
  { value: 'ellipse', label: 'Circle', icon: <Circle size={20} /> },
  { value: 'rubber', label: 'Rubber', icon: <Eraser size={20} /> },
];

/** Draw on the note with a finger: pen, straight lines, arrows, boxes and circles (filled or not), a rubber and undo. */
export function DoodlePad({ body, picture, doodle, onChange, postit }: {
  body: string; picture: string | null; doodle: Doodle; onChange: (d: Doodle) => void; postit: string;
}) {
  const face = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [colour, setColour] = useState(DOODLE_COLOURS[1].value);
  const [width, setWidth] = useState(DOODLE_SIZES[0].value);
  const [fill, setFill] = useState(false);
  const [drawing, setDrawing] = useState<DoodleItem | null>(null);
  const [history, setHistory] = useState<Doodle[]>([]);
  const full = countPoints(doodle) >= MAX_POINTS;

  const at = (e: React.PointerEvent) => {
    const r = face.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100] as const;
  };
  const commit = (next: Doodle) => { setHistory((h) => [...h.slice(-30), doodle]); onChange(next); };

  function down(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = at(e);
    if (tool === 'rubber') { rub(x, y); setDrawing({ k: 'pen', c: '#000000', w: 0, p: [] }); return; }
    if (full) return;
    const p = tool === 'pen' ? addPoint([], x, y) : addPoint([], x, y).concat(addPoint([], x, y));
    setDrawing({ k: tool, c: colour, w: width, ...(tool === 'rect' || tool === 'ellipse' ? { f: fill } : {}), p });
  }
  function move(e: React.PointerEvent) {
    if (!drawing) return;
    const [x, y] = at(e);
    if (tool === 'rubber') { rub(x, y); return; }
    if (drawing.k === 'pen') setDrawing({ ...drawing, p: addPoint(drawing.p, x, y) });
    else setDrawing({ ...drawing, p: [drawing.p[0], drawing.p[1], ...addPoint([], x, y, 0)] });
  }
  function up() {
    const d = drawing;
    setDrawing(null);
    if (!d || tool === 'rubber') return;
    if (d.k !== 'pen' && Math.hypot(d.p[2] - d.p[0], d.p[3] - d.p[1]) < 1.5) return; // a tap, not a shape
    commit({ v: 1, items: [...doodle.items, d] });
  }
  function rub(x: number, y: number) {
    const keep = doodle.items.filter((it) => !hits(it, x, y));
    if (keep.length !== doodle.items.length) commit({ v: 1, items: keep });
  }
  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
  }

  const shape = tool === 'rect' || tool === 'ellipse';
  return (
    <div className="doodle-pad">
      <div className="doodle-tools" role="radiogroup" aria-label="Drawing tool">
        {TOOLS.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={tool === t.value} aria-label={t.label} title={t.label}
            className="doodle-tool" onClick={() => setTool(t.value)}>{t.icon}</button>
        ))}
      </div>
      <div className="doodle-tools">
        <div className="doodle-colours" role="radiogroup" aria-label="Colour">
          {DOODLE_COLOURS.map((c) => (
            <button key={c.value} type="button" role="radio" aria-checked={colour === c.value} aria-label={c.label} title={c.label}
              className="doodle-colour" style={{ background: c.value }} onClick={() => { setColour(c.value); if (tool === 'rubber') setTool('pen'); }} />
          ))}
        </div>
        <div className="doodle-sizes" role="radiogroup" aria-label="Thickness">
          {DOODLE_SIZES.map((s) => (
            <button key={s.value} type="button" role="radio" aria-checked={width === s.value} aria-label={s.label} title={s.label}
              className="doodle-tool" onClick={() => setWidth(s.value)}>
              <span className="doodle-size-dot" style={{ width: s.value * 4 + 2, height: s.value * 4 + 2 }} />
            </button>
          ))}
        </div>
        <button type="button" className="doodle-tool" aria-pressed={fill} aria-label="Fill shapes in" title="Fill shapes in"
          disabled={!shape} onClick={() => setFill((f) => !f)}><PaintBucket size={20} /></button>
      </div>
      <div ref={face} className={`doodle-surface postit-${postit}`} data-no-drag-scroll
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <NoteFace body={body} picture={picture} doodle={doodle}>
          {drawing && drawing.p.length > 0 && tool !== 'rubber' && (
            <svg className="note-doodle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><DoodleShape it={drawing} /></svg>
          )}
        </NoteFace>
      </div>
      <div className="doodle-tools">
        <button type="button" className="btn btn-secondary" disabled={!history.length} onClick={undo}><Undo2 size={18} /> Undo</button>
        <button type="button" className="btn btn-secondary" disabled={!doodle.items.length} onClick={() => commit({ v: 1, items: [] })}>
          <Trash2 size={18} /> Clear drawing
        </button>
      </div>
      {full && <p className="muted small">That's as much drawing as a note can hold. Use the rubber or undo to make room.</p>}
    </div>
  );
}
