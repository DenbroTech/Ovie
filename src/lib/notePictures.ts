import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { BUCKET } from './photos';
import { shrinkImage } from './images';

/** GIFs from the gallery are kept as they are (so they still move) when they're small enough. */
const KEEP_GIF_BYTES = 4.5 * 1024 * 1024;

/** Upload a picture for a note into <household>/notes/ and return its storage path. */
export async function uploadNotePicture(householdId: string, file: File): Promise<string> {
  const asGif = file.type === 'image/gif' && file.size <= KEEP_GIF_BYTES;
  const blob = asGif ? file : (await shrinkImage(file)).blob;
  const path = `${householdId}/notes/${crypto.randomUUID()}.${asGif ? 'gif' : 'jpg'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: asGif ? 'image/gif' : 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Private links for note pictures (refreshed every 50 minutes). */
export function useNotePictures(paths: Array<string | null | undefined>): Record<string, string> {
  const key = [...new Set(paths.filter((p): p is string => !!p))].sort().join('|');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 50 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void supabase.storage.from(BUCKET).createSignedUrls(key.split('|'), 3600).then(({ data }) => {
      if (!alive || !data) return;
      const map: Record<string, string> = {};
      for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      setUrls(map);
    });
    return () => { alive = false; };
  }, [key, tick]);
  return urls;
}

/** The picture to show on a note: its GIF, or its uploaded picture's private link. */
export function notePicture(n: { gif_url?: string | null; image_path?: string | null }, urls: Record<string, string>): string | null {
  return n.gif_url ?? (n.image_path ? urls[n.image_path] ?? null : null);
}
