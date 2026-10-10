/** Notes look like sticky notes: four colours, each stuck on at a slightly different angle. */
export type PostitColour = 'yellow' | 'pink' | 'aqua' | 'green';

/** The colour saved on a note (from the database) → the sticky-note colour shown. */
export function postitColour(saved: string): PostitColour {
  switch (saved) {
    case 'clay': case 'plum': return 'pink';
    case 'sky': return 'aqua';
    case 'sage': return 'green';
    default: return 'yellow';
  }
}

/** The four choices when writing a note, in the order shown (value = what's saved). */
export const POSTIT_CHOICES: Array<{ value: 'sand' | 'clay' | 'sky' | 'sage'; label: string }> = [
  { value: 'sand', label: 'Yellow' }, { value: 'clay', label: 'Pink' }, { value: 'sky', label: 'Aqua' }, { value: 'sage', label: 'Green' },
];

/** A small, steady tilt for each note (the same note always sits at the same angle): -3° to 3°. */
export function postitTilt(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const deg = ((Math.abs(h) % 13) - 6) / 2; // -3 … 3 in half degrees
  return deg === 0 ? 1.5 : deg;
}

/** The screensaver shows the last 4 notes from the past week (pinned ones always count);
 *  if everything is older than that, just the newest one. `notes` come newest/pinned first. */
export function notesForWall<N extends { created_at: string; pinned: boolean }>(notes: N[], now = new Date(), days = 7, max = 4): N[] {
  const cutoff = now.getTime() - days * 86_400_000;
  const recent = notes.filter((n) => n.pinned || new Date(n.created_at).getTime() >= cutoff);
  return recent.length ? recent.slice(0, max) : notes.slice(0, 1);
}
