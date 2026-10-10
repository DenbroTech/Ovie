import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import type { Device, Household, Member } from '../lib/types';
import { useAuth } from './AuthProvider';
import { useConnection } from './ConnectionProvider';
import { DEFAULT_NIGHT, rememberNight } from './theme';

/** loading → (setup | join) → ready.  setup = very first device; join = household exists, pair with code. */
type Status = 'loading' | 'setup' | 'join' | 'ready' | 'error';

interface HouseholdState {
  status: Status;
  error: string | null;
  household: Household | null;
  members: Member[];
  devices: Device[];
  thisDevice: Device | null;
  /** The person this device belongs to (null for the shared wall screen). */
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
  const [devices, setDevices] = useState<Device[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const state = await supabase.rpc('setup_state');
    if (state.error) {
      setError(friendlyError(state.error));
      setStatus('error');
      return;
    }
    if (state.data !== 'paired') {
      setHousehold(null);
      setMembers([]);
      setDevices([]);
      setStatus(state.data === 'setup' ? 'setup' : 'join');
      return;
    }
    const [h, m, d] = await Promise.all([
      supabase.from('households').select('id,name,timezone,invite_code,settings').single(),
      supabase.from('members').select('id,household_id,display_name,colour').order('created_at'),
      supabase.from('devices').select('id,household_id,user_id,member_id,kind,label,last_seen_at').order('created_at'),
    ]);
    const err = h.error ?? m.error ?? d.error;
    if (err) {
      setError(friendlyError(err));
      setStatus('error');
      return;
    }
    setHousehold(h.data as Household);
    setMembers(m.data as Member[]);
    setDevices(d.data as Device[]);
    setStatus('ready');
  }, [userId]);

  useEffect(() => {
    setStatus('loading');
    void load();
  }, [load]);

  const hid = household?.id;
  useEffect(() => {
    if (!hid) return;
    void supabase.rpc('touch_device');
    const channel = supabase
      .channel(`household:${hid}`)
      .on('postgres_changes', { event: '*', schema: 'ovie', table: 'members', filter: `household_id=eq.${hid}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'ovie', table: 'devices', filter: `household_id=eq.${hid}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'ovie', table: 'households', filter: `id=eq.${hid}` }, () => void load())
      .subscribe((s) => {
        reportRealtime(s);
        if (s === 'SUBSCRIBED') void load(); // catch up on anything missed while disconnected
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hid, load, reportRealtime]);

  // Share the home's night hours with the theme (Automatic = dark at night).
  useEffect(() => {
    if (!household) return;
    const st = household.settings as { dark_from?: string; dark_until?: string };
    rememberNight({ from: st.dark_from ?? DEFAULT_NIGHT.from, until: st.dark_until ?? DEFAULT_NIGHT.until, timeZone: household.timezone });
  }, [household]);

  const thisDevice = useMemo(() => devices.find((d) => d.user_id === userId) ?? null, [devices, userId]);
  const me = useMemo(
    () => (thisDevice?.member_id ? members.find((m) => m.id === thisDevice.member_id) ?? null : null),
    [thisDevice, members],
  );

  // If this device was unpaired from another device, drop back to the pairing screen.
  useEffect(() => {
    if (status === 'ready' && devices.length > 0 && !thisDevice) void load();
  }, [status, devices, thisDevice, load]);

  const value = useMemo<HouseholdState>(
    () => ({ status, error, household, members, devices, thisDevice, me, refresh: load }),
    [status, error, household, members, devices, thisDevice, me, load],
  );
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider');
  return ctx;
}
