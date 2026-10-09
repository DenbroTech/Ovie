import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOvieClient } from '../lib/OvieContext';
import { applyTheme } from '../lib/theme';
import type { Household, HouseholdMember, HouseholdSettings, MemberSettings } from '../lib/db-types';

export interface HouseholdData {
  household: Household;
  me: HouseholdMember;
  members: HouseholdMember[];
  settings: HouseholdSettings;
  mySettings: MemberSettings;
}

type HouseholdState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'none' } // signed in but not in any household yet
  | { status: 'ready'; data: HouseholdData };

interface HouseholdContextValue {
  state: HouseholdState;
  reload: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function useHouseholdState(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHouseholdState must be used inside <HouseholdProvider>');
  return ctx;
}

/** For screens that only render once a household is loaded. */
export function useHousehold(): HouseholdData & { reload: () => Promise<void> } {
  const { state, reload } = useHouseholdState();
  if (state.status !== 'ready') throw new Error('useHousehold used before household loaded');
  return { ...state.data, reload };
}

export function HouseholdProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const client = useOvieClient();
  const [state, setState] = useState<HouseholdState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const { data: mine, error: mineErr } = await client
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })
        .limit(1);
      if (mineErr) throw mineErr;
      const householdId = mine?.[0]?.household_id as string | undefined;
      if (!householdId) {
        setState({ status: 'none' });
        return;
      }

      const [household, members, settings, mySettings] = await Promise.all([
        client.from('households').select('id, name, timezone, created_at').eq('id', householdId).single(),
        client.from('household_members').select('*').eq('household_id', householdId).order('joined_at'),
        client.from('household_settings').select('household_id, week_starts_on, prefs').eq('household_id', householdId).single(),
        client.from('member_settings').select('household_id, user_id, theme, prefs')
          .eq('household_id', householdId).eq('user_id', userId).single(),
      ]);
      for (const r of [household, members, settings, mySettings]) if (r.error) throw r.error;

      const memberRows = members.data as HouseholdMember[];
      const me = memberRows.find((m) => m.user_id === userId);
      if (!me) throw new Error('Your membership could not be loaded.');
      const my = mySettings.data as MemberSettings;
      applyTheme(my.theme);
      setState({
        status: 'ready',
        data: {
          household: household.data as Household,
          me,
          members: memberRows,
          settings: settings.data as HouseholdSettings,
          mySettings: my,
        },
      });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, [client, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(() => ({ state, reload: load }), [state, load]);
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
