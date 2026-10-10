import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { friendlyError } from './errors';

/**
 * Load rows and keep them live: any change to `tables` in this household (from any device)
 * reloads the data. Returns the latest rows, the first-load state and an error message.
 */
export function useLive<T>(
  key: string,
  householdId: string | undefined,
  tables: string[],
  load: () => PromiseLike<{ data: unknown; error: unknown }>,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const timer = useRef<number | undefined>(undefined);
  // Unique per hook instance: two screens watching the same table must not share a channel.
  const instance = useRef(Math.random().toString(36).slice(2, 10));

  const reload = useCallback(async () => {
    const res = await loadRef.current();
    if (res.error) setError(friendlyError(res.error));
    else {
      setError(null);
      setData(res.data as T);
    }
  }, []);

  useEffect(() => {
    if (!householdId) return;
    void reload();
    const soon = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void reload(), 120);
    };
    let channel = supabase.channel(`live:${key}:${householdId}:${instance.current}`);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'ovie', table, filter: `household_id=eq.${householdId}` },
        soon,
      );
    }
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') soon();
    });
    return () => {
      window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, householdId, tables.join(','), reload]);

  return { data, setData, error, loading: data === null && !error, reload };
}
