import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MessageSquare, ShoppingCart, SquareCheckBig, Tv, Wallet } from 'lucide-react';
import { OvieSheep } from '../../components/OvieSheep';
import { StackedBars } from '../../components/charts/StackedBars';
import { useHousehold } from '../../app/HouseholdProvider';
import { supabase } from '../../lib/supabase';
import { useLive } from '../../lib/live';
import { usePhotos } from '../../lib/photos';
import { formatClock, formatLongDate } from '../../lib/time';
import { addDays, dayLabel, expandEvents, nextEpisode, todayIso, type EventLike } from '../../lib/dates';
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
interface TitleLite { id: string; name: string; seasons: number[]; kind: string; status: string }
interface ViewLite { title_id: string; member_id: string | null; season: number; episode: number }
interface NoteLite { id: string; body: string; from_member: string | null; to_member: string | null; pinned: boolean }
interface EventLite extends EventLike { title: string; member_id: string | null; location: string | null }
interface ItemLite { id: string; name: string; qty: string | null; list_id: string }

/** The bottom panel rotates through these; the four "today" boxes above always stay. */
export type SlideId = 'week' | 'shopping' | 'money' | 'watchlist';
export const SLIDE_SECONDS = 12;

/** Which bottom slides to cycle through: the week ahead always, the rest only when they have something to show. */
export function slidesToShow(has: Record<Exclude<SlideId, 'week'>, boolean>): SlideId[] {
  return (['week', 'shopping', 'money', 'watchlist'] as SlideId[]).filter((id) => id === 'week' || has[id]);
}

export function Screensaver({ onWake }: { onWake: () => void }) {
  const { household, members } = useHousehold();
  const hid = household?.id;
  const tz = household?.timezone;
  const today = todayIso(tz);
  const weekEnd = addDays(today, 6);
  const [now, setNow] = useState(() => new Date());
  const [photoIdx, setPhotoIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [trend, setTrend] = useState<TrendMonth[] | null>(null);

  const photos = usePhotos(hid);
  const events = useLive<EventLite[]>('ss-events', hid, ['events'], () =>
    supabase.from('events').select('id,title,starts_at,ends_at,all_day,repeat,member_id,location').eq('household_id', hid!));
  const tasks = useLive<TaskLite[]>('ss-tasks', hid, ['tasks'], () =>
    supabase.from('tasks').select('id,title,due_on,assignee_id').eq('household_id', hid!).is('completed_at', null)
      .lte('due_on', weekEnd).order('due_on').limit(7));
  const titles = useLive<TitleLite[]>('ss-titles', hid, ['titles'], () =>
    supabase.from('titles').select('id,name,seasons,kind,status').eq('household_id', hid!).in('status', ['watching', 'want'])
      .order('updated_at', { ascending: false }).limit(8));
  const views = useLive<ViewLite[]>('ss-views', hid, ['viewings'], () =>
    supabase.from('viewings').select('title_id,member_id,season,episode').eq('household_id', hid!).is('member_id', null));
  const notes = useLive<NoteLite[]>('ss-notes', hid, ['notes'], () =>
    supabase.from('notes').select('id,body,from_member,to_member,pinned').eq('household_id', hid!).is('done_at', null)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(4));
  const items = useLive<ItemLite[]>('ss-items', hid, ['shopping_items'], () =>
    supabase.from('shopping_items').select('id,name,qty,list_id').eq('household_id', hid!).is('cleared_at', null).is('checked_at', null)
      .order('created_at').limit(14));

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
  const week = expandEvents(events.data ?? [], today, weekEnd);
  const watching = (titles.data ?? []).filter((t) => t.status === 'watching').map((t) => {
    const next = t.kind === 'show' ? nextEpisode(t.seasons, (views.data ?? []).filter((v) => v.title_id === t.id)) : null;
    return { id: t.id, name: t.name, next: next ? `S${next.season} E${next.episode}` : t.kind === 'film' ? 'Film' : 'All caught up' };
  });
  const wantList = (titles.data ?? []).filter((t) => t.status === 'want');
  // Rent dwarfs everything else, so the screensaver chart leaves it out.
  const chart = trend && trend.length ? spendingSeries(trend, ['RENT']) : null;
  const hasMoney = !!chart && chart.data.some((d) => Object.values(d.values).some((v) => v > 0));

  const todayOcc = week.filter((o) => o.day === today);
  const laterOcc = week.filter((o) => o.day !== today);
  const laterByDay = laterOcc.reduce<Record<string, typeof week>>((acc, o) => { (acc[o.day] ??= []).push(o); return acc; }, {});
  const jobsNow = (tasks.data ?? []).filter((t) => !t.due_on || t.due_on <= today);

  const slides = slidesToShow({
    shopping: (items.data ?? []).length > 0,
    money: hasMoney,
    watchlist: wantList.length > 0,
  });
  useEffect(() => {
    const id = window.setInterval(() => setSlideIdx((i) => i + 1), SLIDE_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);
  const slide = slides[slideIdx % slides.length];
  const current = pics.length ? pics[photoIdx % pics.length] : null;
  const fmtTime = (d: Date) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d);

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

        {/* Always on screen: today at a glance */}
        <div className="ss-grid">
          <section className="ss-card">
            <h3><CalendarDays size={18} /> Today</h3>
            {todayOcc.length === 0 ? <p className="ss-quiet">Nothing on</p> : todayOcc.slice(0, 3).map((o) => (
              <p key={o.event.id} className="ss-line">
                <span className="ss-when">{o.event.all_day ? 'All day' : fmtTime(o.start)}</span>{o.event.title}
              </p>
            ))}
          </section>
          <section className="ss-card">
            <h3><SquareCheckBig size={18} /> Jobs</h3>
            {jobsNow.length === 0 ? <p className="ss-quiet">All done</p> : jobsNow.slice(0, 3).map((t) => (
              <p key={t.id} className={`ss-line${t.due_on && t.due_on < today ? ' ss-late' : ''}`}>
                {t.title}{name(t.assignee_id) ? <span className="ss-who"> · {name(t.assignee_id)}</span> : null}
              </p>
            ))}
          </section>
          <section className="ss-card">
            <h3><Tv size={18} /> Up next</h3>
            {watching.length === 0 ? <p className="ss-quiet">Nothing on the go</p> : watching.slice(0, 3).map((w) => (
              <p key={w.id} className="ss-line">{w.name}<span className="ss-who"> · {w.next}</span></p>
            ))}
          </section>
          <section className="ss-card">
            <h3><MessageSquare size={18} /> Notes</h3>
            {(notes.data ?? []).length === 0 ? <p className="ss-quiet">No notes</p> : (notes.data ?? []).slice(0, 3).map((n) => (
              <p key={n.id} className="ss-line">“{n.body}”<span className="ss-who">{name(n.from_member) ? ` — ${name(n.from_member)}` : ''}</span></p>
            ))}
          </section>
        </div>

        {/* Rotating: more detail, one topic at a time */}
        <section className="ss-slide" key={slide + slideIdx} aria-live="polite">
          {slide === 'week' && (
            <>
              <h3><CalendarDays size={18} /> Coming up this week</h3>
              {laterOcc.length === 0 ? <p className="ss-quiet">Nothing else this week</p> : (
                <div className="ss-days">
                  {Object.entries(laterByDay).slice(0, 4).map(([day, occ]) => (
                    <div key={day}>
                      <div className="ss-day-label">{dayLabel(day, today)}</div>
                      {occ.slice(0, 2).map((o) => (
                        <p key={o.event.id + o.day} className="ss-line">
                          <span className="ss-when">{o.event.all_day ? 'All day' : fmtTime(o.start)}</span>{o.event.title}
                          {name(o.event.member_id) ? <span className="ss-who"> · {name(o.event.member_id)}</span> : null}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {slide === 'shopping' && (
            <>
              <h3><ShoppingCart size={18} /> Shopping list</h3>
              <ul className="ss-shoplist">
                {(items.data ?? []).slice(0, 10).map((i) => <li key={i.id}>{i.name}{i.qty ? <span className="ss-who"> · {i.qty}</span> : null}</li>)}
              </ul>
            </>
          )}
          {slide === 'money' && chart && (
            <>
              <h3><Wallet size={18} /> House spending <span className="ss-who">(last 6 months, not counting rent)</span></h3>
              <div className="ss-chart"><StackedBars data={chart.data} series={chart.series} height={130} compact ariaLabel="House spending per month, not counting rent" /></div>
            </>
          )}
          {slide === 'watchlist' && (
            <>
              <h3><Tv size={18} /> On the watchlist</h3>
              <ul className="ss-shoplist">{wantList.slice(0, 8).map((t) => <li key={t.id} className="ss-nobox">{t.name}</li>)}</ul>
            </>
          )}
        </section>

        {slides.length > 1 && (
          <div className="ss-dots" aria-hidden="true">
            {slides.map((s2, i) => <i key={s2} className={i === slideIdx % slides.length ? 'on' : ''} />)}
          </div>
        )}
      </div>
    </div>
  );
}
