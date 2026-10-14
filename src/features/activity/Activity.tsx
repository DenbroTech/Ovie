import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { Avatar } from '../../components/Avatar';
import { useHousehold } from '../../app/HouseholdProvider';
import { useAuth } from '../../app/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Member } from '../../lib/types';
import { useLive } from '../../lib/live';
import {
  ACTIVITY_COLS, activityItems, ago, markSeen, seenAt, type ActivityItem, type ActivityRow,
} from '../../lib/activity';

const DAYS = 14;

interface ActivityState { items: ActivityItem[]; unread: number; open: boolean; setOpen: (o: boolean) => void }
const Ctx = createContext<ActivityState>({ items: [], unread: 0, open: false, setOpen: () => {} });

/** Loads "What's new" once for the whole app and keeps it live. */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { household, members, devices, me } = useHousehold();
  const { session } = useAuth();
  const hid = household?.id;
  const myUserId = session?.user.id ?? null;
  const live = useLive<ActivityRow[]>('activity', hid, ['activity'], () =>
    supabase.from('activity').select(ACTIVITY_COLS).eq('household_id', hid!)
      .gte('created_at', new Date(Date.now() - DAYS * 86_400_000).toISOString())
      .order('created_at', { ascending: false }).limit(150));
  const [seen, setSeen] = useState(seenAt);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSeen(seenAt());
    window.addEventListener('ovie-activity-seen', on);
    return () => window.removeEventListener('ovie-activity-seen', on);
  }, []);

  const rows = useMemo(() => live.data ?? [], [live.data]);
  const items = useMemo(() => activityItems(rows, {
    myUserId, meId: me?.id ?? null, seenAt: seen, timeZone: household?.timezone,
    memberName: (id) => { const m = members.find((x) => x.id === id); return m ? { name: m.display_name, colour: m.colour } : null; },
    deviceName: (id) => { const d = devices.find((x) => x.id === id); return d ? (d.kind === 'wall' ? 'The wall screen' : d.label) : null; },
  }), [rows, myUserId, me?.id, seen, household?.timezone, members, devices]);
  // count lines, not raw changes, so the number matches what the list shows
  const unread = useMemo(() => items.filter((i) => i.unread).length, [items]);

  return <Ctx.Provider value={{ items, unread, open, setOpen }}>{children}{open && <ActivityPanel />}</Ctx.Provider>;
}

export const useActivity = () => useContext(Ctx);

/** The bell, with a red dot showing how many changes you haven't seen. */
export function ActivityBell({ className = '' }: { className?: string }) {
  const { unread, setOpen } = useActivity();
  return (
    <button type="button" className={`btn btn-ghost btn-icon activity-bell ${className}`} onClick={() => setOpen(true)}
      aria-label={unread ? `What's new: ${unread} new` : "What's new"}>
      <Bell size={26} />
      {unread > 0 && <span className="activity-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
  );
}

function ActivityPanel() {
  const { items, setOpen } = useActivity();
  const navigate = useNavigate();
  const location = useLocation();
  // what was new when the list opened stays marked while it's open; it all counts as seen from now
  const [wasNew] = useState(() => new Set(items.filter((i) => i.unread).flatMap((i) => i.rows.map((r) => r.id))));
  useEffect(() => { markSeen(); }, []);
  const list = items.map((it) => ({ ...it, unread: it.rows.some((r) => wasNew.has(r.id)) }));

  function go(it: ActivityItem) {
    setOpen(false);
    const state = { dir: 'forward', highlight: it.ref, day: it.day };
    navigate(it.path, { state, replace: location.pathname === it.path });
  }

  return (
    <Sheet title="What's new" onClose={() => setOpen(false)}>
      {list.length === 0 ? (
        <p className="muted">Nothing yet. When anyone adds or ticks something off, it shows up here.</p>
      ) : (
        <ul className="activity-list">
          {list.map((it) => (
            <li key={it.key}>
              <button type="button" className={`activity-item${it.unread ? ' is-unread' : ''}`} onClick={() => go(it)}>
                {it.colour ? <Avatar member={{ display_name: it.who, colour: it.colour as Member['colour'] }} size={36} /> : <span className="activity-dot-you" aria-hidden="true">{it.mine ? '🙂' : '🐑'}</span>}
                <span className="activity-text">
                  <span><strong>{it.who}</strong> {it.text}</span>
                  <span className="muted small">{ago(it.at)}</span>
                </span>
                {it.unread && <span className="activity-new" aria-label="new" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/** After following a "What's new" line: scroll to the thing that changed and make it glow for a moment. */
export function useHighlightOnArrival() {
  const location = useLocation();
  const ref = (location.state as { highlight?: string | null } | null)?.highlight ?? null;
  useEffect(() => {
    if (!ref) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-ref="${CSS.escape(ref)}"]`);
      if (el || ++tries > 25) window.clearInterval(id);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash-found');
      void el.offsetWidth; // restart the glow
      el.classList.add('flash-found');
      window.setTimeout(() => el.classList.remove('flash-found'), 2600);
    }, 120);
    return () => window.clearInterval(id);
  }, [ref, location.key]);
}
