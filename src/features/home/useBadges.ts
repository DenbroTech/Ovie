import { supabase } from '../../lib/supabase';
import { useLive } from '../../lib/live';
import { expandEvents, todayIso, type EventLike } from '../../lib/dates';

export interface TodayEvent { title: string; allDay: boolean; start: string }

/** Live numbers for the home screen icons: jobs due by today, things to buy, events today. */
export function useBadges(householdId: string | undefined, timeZone: string | undefined) {
  const today = todayIso(timeZone);
  const tasks = useLive<number>('badge-tasks', householdId, ['tasks'], async () => {
    const r = await supabase.from('tasks').select('id', { count: 'exact', head: true })
      .eq('household_id', householdId!).is('completed_at', null).lte('due_on', today);
    return { data: r.count ?? 0, error: r.error };
  });
  const shopping = useLive<number>('badge-shopping', householdId, ['shopping_items'], async () => {
    const r = await supabase.from('shopping_items').select('id', { count: 'exact', head: true })
      .eq('household_id', householdId!).is('cleared_at', null).is('checked_at', null);
    return { data: r.count ?? 0, error: r.error };
  });
  const events = useLive<TodayEvent[]>('badge-events', householdId, ['events'], async () => {
    const r = await supabase.from('events').select('id,title,starts_at,ends_at,all_day,repeat').eq('household_id', householdId!);
    if (r.error) return { data: [], error: r.error };
    const occ = expandEvents((r.data ?? []) as Array<EventLike & { title: string }>, today, today);
    return { data: occ.map((o) => ({ title: o.event.title, allDay: o.event.all_day, start: o.start.toISOString() })), error: null };
  });
  const notes = useLive<number>('badge-notes', householdId, ['notes'], async () => {
    const r = await supabase.from('notes').select('id', { count: 'exact', head: true })
      .eq('household_id', householdId!).is('done_at', null);
    return { data: r.count ?? 0, error: r.error };
  });
  const todayEvents = events.data ?? [];
  return {
    counts: { tasks: tasks.data ?? 0, shopping: shopping.data ?? 0, calendar: todayEvents.length, notes: notes.data ?? 0 } as Record<string, number>,
    todayEvents,
  };
}
