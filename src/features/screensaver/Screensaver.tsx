import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MessageSquare, ShoppingCart, SquareCheckBig, Tv } from 'lucide-react';
import { OvieSheep } from '../../components/OvieSheep';
import { StackedBars } from '../../components/charts/StackedBars';
import { useHousehold } from '../../app/HouseholdProvider';
import { supabase } from '../../lib/supabase';
import { useLive } from '../../lib/live';
import { usePhotos } from '../../lib/photos';
import { useBadges } from '../home/useBadges';
import { formatClock, formatLongDate } from '../../lib/time';
import { nextEpisode, todayIso } from '../../lib/dates';
import { spendingSeries, type TrendMonth } from '../../lib/financeChart';

// ---------- when to show ----------

const KEY = 'ovie-screensaver-mins';
export const SCREENSAVER_CHOICES = [0, 1, 2, 5, 10, 30];

/** Minutes of no touching before the screensaver starts on THIS device (0 = never). Wall screens default to 2. */
export function screensaverMinutes(isWall: boolean): number {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null && SCREENSAVER_CHOICES.includes(Number(v))) return Number(v);
  } catch { /* ignore */ }
  return isWall ? 2 : 0;
}
export function setScreensaverMinutes(n: number) {
  try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
  window.dispatchEvent(new Event('ovie-screensaver-changed'));
}

export function useIdle(minutes: number): [boolean, () => void] {
  const [idle, setIdle] = useState(false);
  const wake = useCallback(() => setIdle(false), []);
  useEffect(() => {
    if (minutes <= 0) { setIdle(false); return; }
    let timer = window.setTimeout(() => setIdle(true), minutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), minutes * 60_000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes]);
  return [idle, wake];
}

// ---------- what to show ----------

interface TaskLite { id: string; title: string; due_on: string | null; assignee_id: string | null }
interface TitleLite { id: string; name: string; seasons: number[]; kind: string }
interface ViewLite { title_id: string; member_id: string | null; season: number; episode: number }
interface NoteLite { id: string; body: string; from_member: string | null; to_member: string | null }

export function Screensaver({ onWake }: { onWake: () => void }) {
  const { household, members } = useHousehold();
  const hid = household?.id;
  const tz = household?.timezone;
  const today = todayIso(tz);
  const [now, setNow] = useState(() => new Date());
  const [photoIdx, setPhotoIdx] = useState(0);
  const [trend, setTrend] = useState<TrendMonth[] | null>(null);

  const { counts, todayEvents } = useBadges(hid, tz);
  const photos = usePhotos(hid);
  const tasks = useLive<TaskLite[]>('ss-tasks', hid, ['tasks'], () =>
    supabase.from('tasks').select('id,title,due_on,assignee_id').eq('household_id', hid!).is('completed_at', null)
      .lte('due_on', today).order('due_on').limit(3));
  const titles = useLive<TitleLite[]>('ss-titles', hid, ['titles'], () =>
    supabase.from('titles').select('id,name,seasons,kind').eq('household_id', hid!).eq('status', 'watching').order('updated_at', { ascending: false }).limit(2));
  const views = useLive<ViewLite[]>('ss-views', hid, ['viewings'], () =>
    supabase.from('viewings').select('title_id,member_id,season,episode').eq('household_id', hid!).is('member_id', null));
  const notes = useLive<NoteLite[]>('ss-notes', hid, ['notes'], () =>
    supabase.from('notes').select('id,body,from_member,to_member').eq('household_id', hid!).is('done_at', null)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(2));

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const load = () => void supabase.rpc('casa_trend', { p_months: 6 }).then(({ data, error }) => setTrend(error ? null : (data as TrendMonth[])));
    load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const pics = (photos.data ?? []).filter((p) => photos.urls[p.path]);
  useEffect(() => {
    if (pics.length < 2) return;
    const id = window.setInterval(() => setPhotoIdx((i) => i + 1), 15_000);
    return () => window.clearInterval(id);
  }, [pics.length]);

  const name = (id: string | null) => members.find((m) => m.id === id)?.display_name;
  const watching = (titles.data ?? []).map((t) => {
    const next = t.kind === 'show' ? nextEpisode(t.seasons, (views.data ?? []).filter((v) => v.title_id === t.id)) : null;
    return { name: t.name, next: next ? `S${next.season} E${next.episode}` : t.kind === 'film' ? 'Film' : null };
  });
  const chart = trend && trend.length ? spendingSeries(trend) : null;
  const current = pics.length ? pics[photoIdx % pics.length] : null;

  return (
    <div className="ss" role="button" tabIndex={0} aria-label="Screensaver. Tap to go back." onClick={onWake}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onWake()}>
      <div className="ss-photo">
        {current ? (
          pics.map((p, i) => (
            <img key={p.id} src={photos.urls[p.path]} alt="" className={i === photoIdx % pics.length ? 'on' : ''} />
          ))
        ) : (
          <div className="ss-nophoto"><OvieSheep size={150} mood="sleepy" /><p>Add photos in the Photos app</p></div>
        )}
      </div>

      <div className="ss-info">
        <div className="ss-top">
          <div>
            <div className="ss-clock">{formatClock(now, tz)}</div>
            <div className="ss-date">{formatLongDate(now, tz)}</div>
          </div>
          <OvieSheep size={64} />
        </div>

        <div className="ss-grid">
          <section className="ss-card">
            <h3><CalendarDays size={18} /> Today</h3>
            {todayEvents.length === 0 ? <p className="ss-quiet">Nothing on</p> : todayEvents.slice(0, 3).map((e) => (
              <p key={e.start + e.title} className="ss-line">
                <span className="ss-when">{e.allDay ? 'All day' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date(e.start))}</span>
                {e.title}
              </p>
            ))}
          </section>

          <section className="ss-card">
            <h3><SquareCheckBig size={18} /> Jobs due</h3>
            {(tasks.data ?? []).length === 0 ? <p className="ss-quiet">All done</p> : (tasks.data ?? []).map((t) => (
              <p key={t.id} className={`ss-line${t.due_on && t.due_on < today ? ' ss-late' : ''}`}>
                {t.title}{name(t.assignee_id) ? <span className="ss-who"> · {name(t.assignee_id)}</span> : null}
              </p>
            ))}
          </section>

          <section className="ss-card">
            <h3><Tv size={18} /> Up next</h3>
            {watching.length === 0 ? <p className="ss-quiet">Nothing on the go</p> : watching.map((w) => (
              <p key={w.name} className="ss-line">{w.name}{w.next ? <span className="ss-who"> · {w.next}</span> : null}</p>
            ))}
            <p className="ss-line ss-shop"><ShoppingCart size={16} /> {counts.shopping ? `${counts.shopping} to buy` : 'Shopping list clear'}</p>
          </section>

          <section className="ss-card">
            <h3><MessageSquare size={18} /> Notes</h3>
            {(notes.data ?? []).length === 0 ? <p className="ss-quiet">No notes</p> : (notes.data ?? []).map((n) => (
              <p key={n.id} className="ss-line ss-note">
                “{n.body}”
                <span className="ss-who"> {name(n.from_member) ? `— ${name(n.from_member)}` : ''}{n.to_member ? ` for ${name(n.to_member) ?? ''}` : ''}</span>
              </p>
            ))}
          </section>
        </div>

        {chart && (
          <section className="ss-card ss-chart">
            <h3>House spending, last 6 months</h3>
            <StackedBars data={chart.data} series={chart.series} height={130} compact ariaLabel="House spending per month" />
          </section>
        )}
      </div>
    </div>
  );
}
