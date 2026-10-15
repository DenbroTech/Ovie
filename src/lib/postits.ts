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

/** Which notes the screensaver shows: up to 4 from the last 2 days (pinned ones always count as new), and never
 *  fewer than the 2 newest, however old. `notes` come pinned first, then newest. */
export function notesForWall<N extends { created_at: string; pinned: boolean }>(
  notes: N[], now = new Date(), days = 2, min = 2, max = 4,
): N[] {
  const cutoff = now.getTime() - days * 86_400_000;
  const shown = notes.filter((n) => n.pinned || new Date(n.created_at).getTime() >= cutoff).slice(0, max);
  if (shown.length >= min) return shown;
  // top up with the newest notes, by when they were written
  const newest = [...notes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const n of newest) {
    if (shown.length >= min) break;
    if (!shown.includes(n)) shown.push(n);
  }
  return shown;
}
