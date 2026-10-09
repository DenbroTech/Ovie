import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import type { Household, Member } from '../lib/types';
import { useAuth } from './AuthProvider';
import { useConnection } from './ConnectionProvider';

type Status = 'loading' | 'none' | 'ready' | 'error';

interface HouseholdState {
  status: Status;
  error: string | null;
  household: Household | null;
  members: Member[];
  me: Member | null;
  refresh: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { reportRealtime } = useConnection();
  const userId = session?.user.id ?? null;
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const mine = await supabase
      .from('members')
      .select('household_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (mine.error) {
      setError(friendlyError(mine.error));
      setStatus('error');
      return;
    }
    if (!mine.data) {
      setHousehold(null);
      setMembers([]);
      setStatus('none');
      return;
    }
    const hid = mine.data.household_id as string;
    const [h, m] = await Promise.all([
      supabase.from('households').select('id,name,timezone,invite_code,settings').eq('id', hid).single(),
      supabase.from('members').select('id,household_id,user_id,display_name,role,colour,prefs')
        .eq('household_id', hid).order('created_at'),
    ]);
    if (h.error || m.error) {
      setError(friendlyError(h.error ?? m.error));
      setStatus('error');
      return;
    }
    setHousehold(h.data as Household);
    setMembers(m.data as Member[]);
    setStatus('ready');
  }, [userId]);

  useEffect(() => {
    setStatus('loading');
    void load();
  }, [load]);

  // Live updates: names, colours, invite code changed on another device.
  const hid = household?.id;
  useEffect(() => {
    if (!hid) return;
    const channel = supabase
      .channel(`household:${hid}`)
      .on('postgres_changes', { event: '*', schema: 'ovie', table: 'members', filter: `household_id=eq.${hid}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'ovie', table: 'households', filter: `id=eq.${hid}` }, () => void load())
      .subscribe((s) => {
        reportRealtime(s);
        if (s === 'SUBSCRIBED') void load(); // catch anything missed while disconnected
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hid, load, reportRealtime]);

  const me = useMemo(() => members.find((m) => m.user_id === userId) ?? null, [members, userId]);

  const value = useMemo<HouseholdState>(
    () => ({ status, error, household, members, me, refresh: load }),
    [status, error, household, members, me, load],
  );
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider');
  return ctx;
}
