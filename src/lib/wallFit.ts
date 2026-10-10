/** Ovie's wall layout is designed for the frame's 7" screen at 1024x600. If the Pi sends a bigger
 *  picture (e.g. 1920x1080 left over from a computer monitor), scale everything up to match, so it
 *  looks the same whatever resolution the Pi uses. */
export const WALL_SIZE = { width: 1024, height: 600 };

export function wallZoom(width: number, height: number): number {
  const z = Math.min(width / WALL_SIZE.width, height / WALL_SIZE.height);
  return z > 1.05 ? Math.floor(z * 100) / 100 : 1;
}

/** Applies (or clears) the wall zoom on <html>; returns a cleanup. */
export function fitWall(root: HTMLElement): () => void {
  const apply = () => {
    const z = wallZoom(window.innerWidth, window.innerHeight);
    root.style.zoom = z === 1 ? '' : String(z);
    root.style.setProperty('--wall-zoom', String(z));
  };
  apply();
  window.addEventListener('resize', apply);
  return () => {
    window.removeEventListener('resize', apply);
    root.style.zoom = '';
    root.style.removeProperty('--wall-zoom');
  };
}
