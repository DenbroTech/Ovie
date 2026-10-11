import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLive } from './live';

export interface Photo {
  id: string; path: string; caption: string | null; width: number | null; height: number | null; created_at: string;
  /** The part shown on the wall (fractions of the picture), chosen in Photos → Fit to wall; null = the middle. */
  crop_x: number | null; crop_y: number | null; crop_w: number | null; crop_h: number | null;
}
export const BUCKET = 'ovie-photos';

/** Live list of photos with short-lived private links (refreshed every 50 minutes). */
export function usePhotos(householdId: string | undefined) {
  const live = useLive<Photo[]>('photos', householdId, ['photos'], () =>
    supabase.from('photos').select('id,path,caption,width,height,created_at,crop_x,crop_y,crop_w,crop_h').eq('household_id', householdId!).order('created_at', { ascending: false }));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 50 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const paths = (live.data ?? []).map((p) => p.path).join('|');
  useEffect(() => {
    const list = paths ? paths.split('|') : [];
    if (list.length === 0) { setUrls({}); return; }
    let alive = true;
    void supabase.storage.from(BUCKET).createSignedUrls(list, 3600).then(({ data }) => {
      if (!alive || !data) return;
      const map: Record<string, string> = {};
      for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      setUrls(map);
    });
    return () => { alive = false; };
  }, [paths, tick]);

  return { ...live, urls };
}
