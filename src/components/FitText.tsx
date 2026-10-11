import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Text that sizes itself to fill its box: as big as `max` (px) when there's room, shrinking towards `min`
 *  so the whole thing shows. Only if it still doesn't fit at `min` does it get cut off. */
export function FitText({ children, max, min, className, onFit }: {
  children: ReactNode; max: number; min: number; className?: string;
  /** Told whether the text fits (false = cut off even at `min`). */
  onFit?: (fits: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fits = nothing spills out of the box, and no line inside spills sideways out of its own column or item.
    const fits = () => {
      if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return false;
      for (const child of el.querySelectorAll<HTMLElement>('*')) {
        if (child.clientWidth > 0 && child.scrollWidth > child.clientWidth + 1) return false;
      }
      return true;
    };
    const fit = () => {
      if (!el.clientHeight) return;
      let lo = min, hi = max;
      el.style.fontSize = `${hi}px`;
      if (!fits()) {
        for (let i = 0; i < 9; i++) {
          const mid = (lo + hi) / 2;
          el.style.fontSize = `${mid}px`;
          if (fits()) lo = mid; else hi = mid;
        }
        el.style.fontSize = `${lo}px`;
      }
      el.dataset.overflow = fits() ? 'no' : 'yes';
      onFit?.(fits());
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, max, min, onFit]);
  return <div ref={ref} className={`fit-text${className ? ` ${className}` : ''}`}>{children}</div>;
}
