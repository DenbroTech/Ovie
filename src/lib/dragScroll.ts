/** Drag-to-scroll for the wall screen. Many small HDMI touchscreens tell the Pi they're a mouse, so a finger
 *  drag arrives as a mouse drag and nothing scrolls. This scrolls whatever is under the finger instead, and
 *  swallows the click at the end of a drag so dragging over a button doesn't press it. Real touch is left to
 *  the browser. Opt out on an element with data-no-drag-scroll (e.g. the photo framing window). */
const THRESHOLD = 8; // px of movement before a press becomes a drag

function scrollerAt(el: Element | null): HTMLElement | null {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  const root = document.scrollingElement as HTMLElement | null;
  return root && root.scrollHeight > root.clientHeight + 1 ? root : null;
}

const skip = (el: Element | null) =>
  !!el?.closest('input, textarea, select, [contenteditable="true"], [data-no-drag-scroll]');

export function enableDragScroll(): () => void {
  let start: { x: number; y: number; top: number; el: HTMLElement } | null = null;
  let dragging = false;
  let swallowClick = false;

  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || skip(e.target as Element)) return;
    const el = scrollerAt(e.target as Element);
    start = el ? { x: e.clientX, y: e.clientY, top: el.scrollTop, el } : null;
    dragging = false;
  };
  const move = (e: PointerEvent) => {
    if (!start) return;
    const dy = e.clientY - start.y;
    if (!dragging && Math.abs(dy) < THRESHOLD) return;
    dragging = true;
    start.el.scrollTop = start.top - dy;
    e.preventDefault();
  };
  const up = () => {
    if (dragging) swallowClick = true;
    start = null;
    dragging = false;
  };
  const click = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, { capture: true, passive: false });
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  window.addEventListener('click', click, true);
  return () => {
    window.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    window.removeEventListener('click', click, true);
  };
}
