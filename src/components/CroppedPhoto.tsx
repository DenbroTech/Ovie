import { useLayoutEffect, useRef, useState } from 'react';
import { cropOf, defaultCrop, placeCrop } from '../lib/crop';
import type { Photo } from '../lib/photos';

/** A photo filling its box, showing the part chosen in Photos → Fit to wall (or the middle if none was chosen). */
export function CroppedPhoto({ photo, src, className }: { photo: Photo; src: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const iw = photo.width ?? 0, ih = photo.height ?? 0;
  const pos = size && iw && ih && size.w && size.h
    ? placeCrop(cropOf(photo) ?? defaultCrop(iw, ih, size.w / size.h), iw, ih, size.w, size.h)
    : null;
  return (
    <div ref={box} className={`cropped-photo${className ? ` ${className}` : ''}`}>
      <img src={src} alt="" draggable={false}
        style={pos ? { width: pos.width, height: pos.height, left: pos.left, top: pos.top } : { inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}
