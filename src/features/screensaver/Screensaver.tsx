import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Hourglass, MessageSquare, ShoppingCart, SquareCheckBig, Tv, Wallet } from 'lucide-react';
import { OvieSheep, reactSheep, type SheepMood } from '../../components/OvieSheep';
import { isNight, storedNight } from '../../app/theme';
import { dayMood, notesMood, shoppingMood } from '../../lib/moods';
import { useHousehold } from '../../app/HouseholdProvider';
import { supabase } from '../../lib/supabase';
import { useLive } from '../../lib/live';
import { usePhotos } from '../../lib/photos';
import { formatClock, formatLongDate } from '../../lib/time';
import { addDays, countdowns, daysBetween, expandEvents, money, nextEpisode, parseIso, todayIso, type EventLike } from '../../lib/dates';
import { RELEASE_COLS, episodeRelease, nextOutEpisode, upcomingReleases, type ReleaseFields } from '../../lib/releases';
import { notesForWall, postitColour, postitTilt } from '../../lib/postits';
import { moneyGlance, type TrendMonth } from '../../lib/financeChart';

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
interface TitleLite extends ReleaseFields { id: string; name: string; seasons: number[]; kind: string; status: string }
interface ViewLite { title_id: string; member_id: string | null; season: number; episode: number }
interface NoteLite { id: string; body: string; from_member: string | null; to_member: string | null; pinned: boolean; colour: string; created_at: string }
interface EventLite extends EventLike { title: string; member_id: string | null; location: string | null }
interface ItemLite { id: string; name: string; qty: string | null; list_id: string }

/** One big panel shows one topic at a time, readable from across the room. Today always comes first. */
export type SlideId = 'today' | 'jobs' | 'countdown' | 'week' | 'notes' | 'shopping' | 'money' | 'watch';
export const SLIDE_SECONDS = 10;
const ORDER: SlideId[] = ['today', 'jobs', 'countdown', 'week', 'notes', 'shopping', 'money', 'watch'];

/** Which topics to cycle through: today always, the rest only when they have something to show. */
export function slidesToShow(has: Partial<Record<Exclude<SlideId, 'today'>, boolean>>): SlideId[] {
  return ORDER.filter((id) => id === 'today' || has[id as Exclude<SlideId, 'today'>]);
}

/** How far through the month today is (0–1), for "on track" against a usual month. */
export function monthFraction(today: string): number {
  const d = parseIso(today);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() / days;
}

/** Plain words for the money slide: is this month's spending on track against a usual month? */
export function moneyStatus(spent: number, usual: number | null, fraction: number): { text: string; tone: 'good' | 'warn' | 'over' } | null {
  if (!usual) return null;
  const left = usual - spent;
  if (left < 0) return { text: `${money(Math.round(-left))} more than a usual month`, tone: 'over' };
  if (spent <= usual * fraction * 1.1) return { text: `On track · ${money(Math.round(left))} left of a usual month`, tone: 'good' };
  return { text: `Spending faster than usual · ${money(Math.round(left))} left`, tone: 'warn' };
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
    supabase.from('titles').select(`id,name,seasons,kind,status,${RELEASE_COLS}`).eq('household_id', hid!).in('status', ['watching', 'want'])
      .order('updated_at', { ascending: false }).limit(8));
  const views = useLive<ViewLite[]>('ss-views', hid, ['viewings'], () =>
    supabase.from('viewings').select('title_id,member_id,season,episode').eq('household_id', hid!).is('member_id', null));
  const notes = useLive<NoteLite[]>('ss-notes', hid, ['notes'], () =>
    supabase.from('notes').select('id,body,from_member,to_member,pinned,colour,created_at').eq('household_id', hid!).is('done_at', null)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(8));
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
  const watchedOf = (id: string) => (views.data ?? []).filter((v) => v.title_id === id);
  // Only episodes (and films) that are actually out can be tonight's pick.
  const nextFor = (t: TitleLite) => nextOutEpisode(t, watchedOf(t.id), today);
  const ready = (t: TitleLite) => (t.kind === 'film' ? episodeRelease(t, 0, 0, today).out : !!nextFor(t));
  const wantList = (titles.data ?? []).filter((t) => t.status === 'want');
  // Rent dwarfs everything else (and never changes), so the wall leaves it out.
  const glance = trend && trend.length ? moneyGlance(trend, ['RENT']) : null;
  const hasMoney = !!glance && (glance.spent > 0 || !!glance.usual);
  const status = glance ? moneyStatus(glance.spent, glance.usual, monthFraction(today)) : null;
  const counts = [
    ...countdowns(events.data ?? [], today).map((c) => ({ id: c.event.id, title: c.event.title, days: c.days })),
    ...upcomingReleases(titles.data ?? [], watchedOf, today),
  ].sort((a, b) => a.days - b.days).slice(0, 3);
  // Tonight's pick: something on the go with an episode left (or a film), else the top of the watchlist.
  const pickTitle = (titles.data ?? []).find((t) => t.status === 'watching' && ready(t)) ?? wantList.find(ready) ?? null;
  const pickNext = pickTitle ? (pickTitle.kind === 'film' ? { season: 0, episode: 0 } : nextFor(pickTitle)) : null;
  const pick = pickTitle && pickNext ? { title: pickTitle, next: pickNext, label: pickTitle.kind === 'film' ? 'Film' : `S${pickNext.season} E${pickNext.episode}` } : null;

  const todayOcc = week.filter((o) => o.day === today);
  const laterOcc = week.filter((o) => o.day !== today);
  const jobsNow = (tasks.data ?? []).filter((t) => !t.due_on || t.due_on <= today);

  const wallNotes = notesForWall(notes.data ?? [], now);
  const slides = slidesToShow({
    jobs: jobsNow.length > 0,
    week: laterOcc.length > 0,
    notes: wallNotes.length > 0,
    shopping: (items.data ?? []).length > 0,
    countdown: counts.length > 0,
    money: hasMoney,
    watch: !!pick,
  });
  // After a Done tap, stay on this topic a little longer so you can tick off a few.
  const lastTap = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => { if (Date.now() - lastTap.current > 20_000) setSlideIdx((i) => i + 1); }, SLIDE_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);
  const slide = slides[slideIdx % slides.length];

  // Done buttons right on the screensaver (they don't wake it up).
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const tapped = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    lastTap.current = Date.now();
    setFailed(false);
    setDoneIds((d) => [...d, id]);
  };
  const settle = (ok: boolean, id: string, reload: () => void) => {
    if (!ok) { setFailed(true); setDoneIds((d) => d.filter((x) => x !== id)); return; }
    window.setTimeout(() => { reload(); setDoneIds((d) => d.filter((x) => x !== id)); }, 1500);
  };
  async function finishJob(e: React.MouseEvent, t: TaskLite) {
    if (doneIds.includes(t.id)) { e.stopPropagation(); return; }
    tapped(e, t.id);
    const { error } = await supabase.rpc('complete_task', { p_task_id: t.id, p_by: null });
    if (!error) reactSheep('celebrating');
    settle(!error, t.id, () => void tasks.reload());
  }
  async function watchedIt(e: React.MouseEvent) {
    if (!pick || !hid || doneIds.includes(pick.title.id)) { e.stopPropagation(); return; }
    const { title: t, next } = pick;
    tapped(e, t.id);
    const { error } = await supabase.from('viewings').upsert(
      { household_id: hid, title_id: t.id, member_id: null, season: next.season, episode: next.episode },
      { onConflict: 'title_id,member_id,season,episode', ignoreDuplicates: true });
    if (!error) {
      const finished = t.kind === 'film' || nextEpisode(t.seasons, [...(views.data ?? []).filter((v) => v.title_id === t.id), next]) === null;
      if (finished) await supabase.from('titles').update({ status: 'done' }).eq('id', t.id);
      else if (t.status !== 'watching') await supabase.from('titles').update({ status: 'watching' }).eq('id', t.id);
    }
    if (!error) reactSheep('celebrating');
    settle(!error, t.id, () => { void views.reload(); void titles.reload(); });
  }
  const current = pics.length ? pics[photoIdx % pics.length] : null;
  // Ovie in the corner matches what's showing (and sleeps at night).
  const night = isNight(now, { ...storedNight(), timeZone: tz });
  const baseMood = dayMood({ night, todayTitles: todayOcc.map((o) => o.event.title) });
  const cornerMood: SheepMood = night && baseMood === 'sleepy' ? 'sleepy' : ({
    today: baseMood, jobs: 'working', countdown: 'excited', week: 'calendar',
    notes: notesMood(notes.data ?? [], null, now), shopping: shoppingMood((items.data ?? []).length),
    money: 'finances', watch: 'watch',
  } as Record<SlideId, SheepMood>)[slide];
  const shortDay = (day: string) => daysBetween(today, day) === 1 ? 'Tomorrow' : parseIso(day).toLocaleDateString(undefined, { weekday: 'short' });
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
          <div className="ss-nophoto"><OvieSheep size={150} mood="photos" /><p>Add photos in the Photos app</p></div>
        )}
      </div>

      <div className="ss-info">
        <div className="ss-top">
          <div>
            <div className="ss-clock">{formatClock(now, tz)}</div>
            <div className="ss-date">{formatLongDate(now, tz)}</div>
          </div>
          <OvieSheep size={84} reacts mood={cornerMood} />
        </div>

        {/* One topic at a time, in big type */}
        <section className="ss-slide" key={slide + slideIdx} aria-live="polite">
          {slide === 'today' && (
            <>
              <h3><CalendarDays size={24} /> Today</h3>
              {todayOcc.length === 0 ? <p className="ss-big-quiet">Nothing on today</p> : todayOcc.slice(0, 3).map((o) => (
                <p key={o.event.id} className="ss-item">
                  <span className="ss-when">{o.event.all_day ? 'All day' : fmtTime(o.start)}</span>{o.event.title}
                </p>
              ))}
            </>
          )}
          {slide === 'jobs' && (
            <>
              <h3><SquareCheckBig size={24} /> Jobs to do{jobsNow.length > 3 ? ` · ${jobsNow.length}` : ''}</h3>
              {jobsNow.slice(0, 3).map((t) => {
                const done = doneIds.includes(t.id);
                return (
                  <div key={t.id} className={`ss-job${done ? ' is-done' : ''}`}>
                    <button type="button" className="ss-tick" aria-label={`Done: ${t.title}`} aria-pressed={done} onClick={(e) => void finishJob(e, t)}>
                      <Check size={34} strokeWidth={3.5} />
                    </button>
                    <p className={`ss-item${t.due_on && t.due_on < today ? ' ss-late' : ''}`}>
                      {t.title}{name(t.assignee_id) ? <span className="ss-who"> · {name(t.assignee_id)}</span> : null}
                    </p>
                  </div>
                );
              })}
              {failed && <p className="ss-oops">Couldn't save that. Check the internet and try again.</p>}
            </>
          )}
          {slide === 'countdown' && (
            <>
              <h3><Hourglass size={24} /> Countdown</h3>
              <div className="ss-counts">
                {counts.slice(0, 2).map((c) => (
                  <div key={c.id} className="ss-count">
                    <div className="ss-count-num">{c.days}<span>{c.days === 1 ? 'day' : 'days'}</span></div>
                    <div className="ss-count-title">{c.title}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {slide === 'week' && (
            <>
              <h3><CalendarDays size={24} /> Coming up</h3>
              {laterOcc.slice(0, 3).map((o) => (
                <p key={o.event.id + o.day} className="ss-item">
                  <span className="ss-when">{shortDay(o.day)}</span>{o.event.title}
                </p>
              ))}
            </>
          )}
          {slide === 'notes' && (
            <>
              <h3><MessageSquare size={24} /> Notes</h3>
              <div className={`ss-postits ss-postits-${wallNotes.length}`}>
                {wallNotes.map((n) => (
                  <div key={n.id} className={`postit postit-${postitColour(n.colour)}`} style={{ '--tilt': `${postitTilt(n.id)}deg` } as React.CSSProperties}>
                    <p className="postit-body">{n.body}</p>
                    {name(n.from_member) && <p className="postit-from">— {name(n.from_member)}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
          {slide === 'shopping' && (
            <>
              <h3><ShoppingCart size={24} /> To buy{(items.data ?? []).length > 6 ? ` · ${(items.data ?? []).length}` : ''}</h3>
              <ul className="ss-shoplist">
                {(items.data ?? []).slice(0, 6).map((i) => <li key={i.id}>{i.name}</li>)}
              </ul>
            </>
          )}
          {slide === 'money' && glance && (
            <>
              <h3><Wallet size={24} /> Spent this month <span className="ss-who">· not counting rent</span></h3>
              <div className="ss-money-big">{money(Math.round(glance.spent))}</div>
              {glance.usual ? (
                <div className="ss-meter" aria-hidden="true">
                  <i className={`tone-${status?.tone ?? 'good'}`} style={{ width: `${Math.min(100, (glance.spent / glance.usual) * 100)}%` }} />
                  <b style={{ left: `${monthFraction(today) * 100}%` }} />
                </div>
              ) : null}
              {status && <p className={`ss-money-status tone-${status.tone}`}>{status.tone === 'good' ? 'On track' : status.tone === 'warn' ? 'Spending fast' : 'Over a usual month'}</p>}
            </>
          )}
          {slide === 'watch' && pick && (
            <>
              <h3><Tv size={24} /> Tonight's pick</h3>
              <div className="ss-pick">
                <span className="ss-pick-title">{pick.title.name}</span>
                <span className="ss-pill">{pick.label}</span>
              </div>
              <button type="button" className={`ss-done-btn${doneIds.includes(pick.title.id) ? ' is-done' : ''}`} onClick={(e) => void watchedIt(e)}>
                <Check size={32} strokeWidth={3.5} /> {doneIds.includes(pick.title.id) ? 'Nice!' : pick.title.kind === 'film' ? 'Watched it' : `Watched ${pick.label}`}
              </button>
              {failed && <p className="ss-oops">Couldn't save that. Check the internet and try again.</p>}
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
