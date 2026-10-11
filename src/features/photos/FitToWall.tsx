import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { clampCrop, cropOf, defaultCrop, resizeCrop, WALL_PHOTO_ASPECT, type Crop } from '../../lib/crop';
import type { Photo } from '../../lib/photos';

/** Drag the window to choose which part of the photo the wall screen shows; drag its corner (or the slider) to resize. */
export function FitToWall({ photo, src, onClose, onSaved }: { photo: Photo; src: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const iw = photo.width ?? 1600, ih = photo.height ?? 1200;
  const biggest = defaultCrop(iw, ih, WALL_PHOTO_ASPECT);
  const [crop, setCrop] = useState<Crop>(() => cropOf(photo) ?? biggest);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'size'; x: number; y: number; start: Crop } | null>(null);

  function begin(mode: 'move' | 'size', e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: crop };
  }
  function move(e: ReactPointerEvent) {
    const d = drag.current, el = frame.current;
    if (!d || !el) return;
    const dx = (e.clientX - d.x) / el.clientWidth, dy = (e.clientY - d.y) / el.clientHeight;
    if (d.mode === 'move') setCrop(clampCrop({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }));
    else setCrop(resizeCrop(d.start, d.start.w + dx * 2, iw, ih));
  }
  const end = () => { drag.current = null; };

  async function save(next: Crop | null) {
    setBusy(true);
    const row = next ? { crop_x: next.x, crop_y: next.y, crop_w: next.w, crop_h: next.h } : { crop_x: null, crop_y: null, crop_w: null, crop_h: null };
    const { error } = await supabase.from('photos').update(row).eq('id', photo.id);
    setBusy(false);
    if (error) { toast(friendlyError(error), 'error'); return; }
    toast(next ? 'The wall will show this part' : 'Back to the middle of the photo');
    onSaved();
  }

  const pct = (n: number) => `${n * 100}%`;
  return (
    <Sheet title="Fit to wall" onClose={onClose} onSubmit={() => void save(crop)} busy={busy} submitLabel="Save"
      footer={<button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void save(null)}>Reset</button>}>
      <p className="muted small">The bright window is what the wall screen shows. Drag it to move it, drag its corner to make it bigger or smaller.</p>
      <div className="fit-stage">
        <div ref={frame} className="fit-frame" style={{ aspectRatio: `${iw} / ${ih}`, width: `min(100%, calc(58dvh * ${iw / ih}))` }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <img src={src} alt="" draggable={false} />
          <div className="fit-window" style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
            onPointerDown={(e) => begin('move', e)} role="presentation">
            <span className="fit-handle" onPointerDown={(e) => begin('size', e)} aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="field">
        <label htmlFor="fit-size">Size</label>
        <input id="fit-size" type="range" min={Math.round(biggest.w * 15)} max={Math.round(biggest.w * 100)} step={1}
          value={Math.round(crop.w * 100)} onChange={(e) => setCrop(resizeCrop(crop, Number(e.target.value) / 100, iw, ih))} />
      </div>
    </Sheet>
  );
}
