/** How much of each edge the wall screen's picture frame covers (in Ovie's 1024x600 layout pixels).
 *  Everything is laid out inside what's left, so nothing hides behind the frame. Per device. */
export interface FrameInsets { left: number; right: number; top: number; bottom: number }
export type FrameEdge = keyof FrameInsets;

const KEY = 'ovie-frame';
export const FRAME_EVENT = 'ovie-frame-changed';
export const FRAME_STEP = 4;
export const FRAME_MAX = 200;
/** Our frame hides the left edge up to about where Ovie's right ear sits on the home screen. */
export const DEFAULT_FRAME: FrameInsets = { left: 88, right: 0, top: 0, bottom: 0 };

const clamp = (n: unknown) => Math.min(FRAME_MAX, Math.max(0, Math.round(Number(n) || 0)));

export function storedFrame(): FrameInsets {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v === 'object') return { left: clamp(v.left), right: clamp(v.right), top: clamp(v.top), bottom: clamp(v.bottom) };
  } catch {
    /* ignore */
  }
  return DEFAULT_FRAME;
}

export function setFrame(f: FrameInsets) {
  const next = { left: clamp(f.left), right: clamp(f.right), top: clamp(f.top), bottom: clamp(f.bottom) };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(FRAME_EVENT));
  return next;
}

/** Applies the insets as CSS variables on <html>; returns a cleanup. */
export function applyFrame(root: HTMLElement): () => void {
  const apply = () => {
    const f = storedFrame();
    for (const e of ['left', 'right', 'top', 'bottom'] as const) root.style.setProperty(`--frame-${e}`, `${f[e]}px`);
  };
  apply();
  window.addEventListener(FRAME_EVENT, apply);
  return () => {
    window.removeEventListener(FRAME_EVENT, apply);
    for (const e of ['left', 'right', 'top', 'bottom']) root.style.removeProperty(`--frame-${e}`);
  };
}
