/** Choosing which part of a photo the wall screen shows. All crops are fractions (0–1) of the picture. */
export interface Crop { x: number; y: number; w: number; h: number }

/** The wall's photo area (the left third of the screen, under the frame) is about 2 wide by 3 tall. */
export const WALL_PHOTO_ASPECT = 2 / 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The biggest window of `aspect` (width/height, in pixels) that fits the picture, in the middle. */
export function defaultCrop(imgW: number, imgH: number, aspect = WALL_PHOTO_ASPECT): Crop {
  const imgAspect = imgW / imgH;
  if (imgAspect > aspect) { const w = aspect / imgAspect; return { x: (1 - w) / 2, y: 0, w, h: 1 }; }
  const h = imgAspect / aspect;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** Keep a window inside the picture. */
export function clampCrop(c: Crop): Crop {
  const w = clamp(c.w, 0.02, 1), h = clamp(c.h, 0.02, 1);
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h };
}

/** Resize a window to `w` (fraction of the picture width) keeping its pixel shape and its centre, inside the picture. */
export function resizeCrop(c: Crop, w: number, imgW: number, imgH: number, aspect = WALL_PHOTO_ASPECT): Crop {
  const max = defaultCrop(imgW, imgH, aspect);
  const nw = clamp(w, max.w * 0.15, max.w);
  const nh = (nw * imgW) / aspect / imgH;
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  return clampCrop({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
}

/** Where to put the picture (pixels) so `crop` fills a box, showing as much of the crop as the box's shape allows. */
export function placeCrop(c: Crop, imgW: number, imgH: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / (c.w * imgW), boxH / (c.h * imgH));
  const width = imgW * scale, height = imgH * scale;
  const left = clamp(boxW / 2 - (c.x + c.w / 2) * width, boxW - width, 0);
  const top = clamp(boxH / 2 - (c.y + c.h / 2) * height, boxH - height, 0);
  return { width, height, left, top };
}

export function cropOf(p: { crop_x: number | null; crop_y: number | null; crop_w: number | null; crop_h: number | null }): Crop | null {
  return p.crop_x === null || p.crop_y === null || p.crop_w === null || p.crop_h === null ? null : { x: p.crop_x, y: p.crop_y, w: p.crop_w, h: p.crop_h };
}
