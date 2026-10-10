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

export type SlideId = 'calendar' | 'jobs' | 'watch' | 'notes' | 'shopping' | 'money';
export const SLIDE_SECONDS = 12;

/** Which slides to cycle through: the calendar always, the rest only when they have something to show. */
export function slidesToShow(has: Record<Exclude<SlideId, 'calendar'>, boolean>): SlideId[] {
  return (['calendar', 'jobs', 'watch', 'notes', 'shopping', 'money'] as SlideId[]).filter((id) => id === 'calendar' || has[id]);
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
  const byDay = week.reduce<Record<string, typeof week>>((acc, o) => { (acc[o.day] ??= []).push(o); return acc; }, {});
  const watching = (titles.data ?? []).filter((t) => t.status === 'watching').map((t) => {
    const next = t.kind === 'show' ? nextEpisode(t.seasons, (views.data ?? []).filter((v) => v.title_id === t.id)) : null;
    return { id: t.id, name: t.name, next: next ? `S${next.season} E${next.episode}` : t.kind === 'film' ? 'Film' : 'All caught up' };
  });
  const wantList = (titles.data ?? []).filter((t) => t.status === 'want');
  // Rent dwarfs everything else, so the screensaver chart leaves it out.
  const chart = trend && trend.length ? spendingSeries(trend, ['RENT']) : null;
  const hasMoney = !!chart && chart.data.some((d) => Object.values(d.values).some((v) => v > 0));

  const slides = slidesToShow({
    jobs: (tasks.data ?? []).length > 0,
    watch: watching.length + wantList.length > 0,
    notes: (notes.data ?? []).length > 0,
    shopping: (items.data ?? []).length > 0,
    money: hasMoney,
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

        <section className="ss-slide" key={slide + slideIdx} aria-live="polite">
          {slide === 'calendar' && (
            <>
              <h3><CalendarDays size={20} /> This week</h3>
              {week.length === 0 ? <p className="ss-big-quiet">Nothing on this week</p> : (
                <div className="ss-days">
                  {Object.entries(byDay).slice(0, 4).map(([day, occ]) => (
                    <div key={day} className="ss-day">
                      <div className="ss-day-label">{dayLabel(day, today)}</div>
                      {occ.slice(0, 3).map((o) => (
                        <p key={o.event.id + o.day} className="ss-line">
                          <span className="ss-when">{o.event.all_day ? 'All day' : fmtTime(o.start)}</span>
                          {o.event.title}
                          {name(o.event.member_id) ? <span className="ss-who"> · {name(o.event.member_id)}</span> : null}
                          {o.event.location ? <span className="ss-who"> · {o.event.location}</span> : null}
                        </p>
                      ))}
                      {occ.length > 3 && <p className="ss-who">+{occ.length - 3} more</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {slide === 'jobs' && (
            <>
              <h3><SquareCheckBig size={20} /> Jobs</h3>
              {(tasks.data ?? []).map((t) => (
                <p key={t.id} className={`ss-row${t.due_on && t.due_on < today ? ' ss-late' : ''}`}>
                  <span className="ss-when">{t.due_on ? (t.due_on < today ? 'Overdue' : dayLabel(t.due_on, today)) : 'Anytime'}</span>
                  <span className="ss-row-text">{t.title}</span>
                  <span className="ss-who">{name(t.assignee_id) ?? 'Anyone'}</span>
                </p>
              ))}
            </>
          )}

          {slide === 'watch' && (
            <>
              <h3><Tv size={20} /> Watch</h3>
              {watching.length > 0 && <div className="ss-sub">Up next</div>}
              {watching.slice(0, 4).map((w) => (
                <p key={w.id} className="ss-row"><span className="ss-row-text">{w.name}</span><span className="ss-ep">{w.next}</span></p>
              ))}
              {wantList.length > 0 && <div className="ss-sub">On the watchlist</div>}
              {wantList.slice(0, 4).map((t) => <p key={t.id} className="ss-row"><span className="ss-row-text">{t.name}</span></p>)}
            </>
          )}

          {slide === 'notes' && (
            <>
              <h3><MessageSquare size={20} /> Notes</h3>
              {(notes.data ?? []).map((n) => (
                <div key={n.id} className="ss-note-card">
                  <p className="ss-note-body">“{n.body}”</p>
                  <p className="ss-who">{name(n.from_member) ? `— ${name(n.from_member)}` : ''}{n.to_member ? ` for ${name(n.to_member) ?? ''}` : ' for everyone'}</p>
                </div>
              ))}
            </>
          )}

          {slide === 'shopping' && (
            <>
              <h3><ShoppingCart size={20} /> Shopping</h3>
              <ul className="ss-shoplist">
                {(items.data ?? []).map((i) => <li key={i.id}>{i.name}{i.qty ? <span className="ss-who"> · {i.qty}</span> : null}</li>)}
              </ul>
            </>
          )}

          {slide === 'money' && chart && (
            <>
              <h3><Wallet size={20} /> House spending, last 6 months <span className="ss-who">(not counting rent)</span></h3>
              <div className="ss-chart"><StackedBars data={chart.data} series={chart.series} height={250} compact ariaLabel="House spending per month, not counting rent" /></div>
            </>
          )}
        </section>

        {slides.length > 1 && (
          <div className="ss-dots" aria-hidden="true">
            {slides.map((s, i) => <i key={s} className={i === slideIdx % slides.length ? 'on' : ''} />)}
          </div>
        )}
      </div>
    </div>
  );
}
