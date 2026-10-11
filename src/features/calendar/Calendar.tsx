import { eventWhenLabel } from '../../lib/menu';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat, Trash2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { PersonPicker, WhoBadge } from '../../components/PersonPicker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';
import { addDays, dayLabel, expandEvents, parseIso, timeLabel, toIso, todayIso, type EventRepeat, type Occurrence } from '../../lib/dates';
import type { Member } from '../../lib/types';

export interface CalEvent {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  member_id: string | null;
  repeat: EventRepeat;
  meal_id: string | null;
}

const COLS = 'id,title,notes,location,starts_at,ends_at,all_day,member_id,repeat,meal_id';
const REPEAT_LABEL: Record<EventRepeat, string> = { none: 'Does not repeat', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };

type View = 'agenda' | 'month';

export function CalendarScreen() {
  const { household, members, me } = useHousehold();
  const { online } = useConnection();
  const hid = household?.id;
  const today = todayIso(household?.timezone);
  const [view, setView] = useState<View>('agenda');
  const [monthStart, setMonthStart] = useState(() => today.slice(0, 8) + '01');
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<CalEvent | { newOn: string } | null>(null);

  const live = useLive<CalEvent[]>('events', hid, ['events'], () =>
    supabase.from('events').select(COLS).eq('household_id', hid!).order('starts_at'));
  const events = live.data ?? [];

  const agenda = useMemo(() => expandEvents(events, today, addDays(today, 60)), [events, today]);
  const monthEnd = toIso(new Date(parseIso(monthStart).getFullYear(), parseIso(monthStart).getMonth() + 1, 0));
  const gridStart = (() => { const d = parseIso(monthStart); const dow = (d.getDay() + 6) % 7; return addDays(monthStart, -dow); })();
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthOcc = useMemo(() => expandEvents(events, gridStart, gridDays[41]), [events, gridStart, gridDays[41]]);
  const byDay = (occ: Occurrence<CalEvent>[]) => occ.reduce<Record<string, Occurrence<CalEvent>[]>>((acc, o) => {
    (acc[o.day] ??= []).push(o); return acc;
  }, {});
  const agendaDays = byDay(agenda);
  const monthDays = byDay(monthOcc);
  const memberById = (id: string | null) => members.find((m) => m.id === id) ?? null;

  const shiftMonth = (n: number) => {
    const d = parseIso(monthStart);
    setMonthStart(toIso(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };

  return (
    <Screen title="Calendar" sheep="calendar" actions={
      <button type="button" className="btn btn-primary btn-icon" aria-label="New event" disabled={!online}
        onClick={() => setEditing({ newOn: view === 'month' ? selected : today })}>
        <Plus size={26} />
      </button>
    }>
      <div className="module">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Coming up</button>
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button>
          </div>
        </div>

        {live.error ? <LoadError message={live.error} onRetry={() => void live.reload()} />
          : live.loading ? <Spinner />
          : view === 'agenda' ? (
            agenda.length === 0 ? <Empty title="Nothing coming up">Tap + to add an appointment, birthday or plan.</Empty> : (
              Object.entries(agendaDays).map(([day, occ]) => (
                <section key={day}>
                  <h3 className="group-label">{dayLabel(day, today)}</h3>
                  <ul className="list">
                    {occ.map((o) => <EventRow key={o.event.id + o.day} occ={o} who={memberById(o.event.member_id)} onOpen={() => setEditing(o.event)} />)}
                  </ul>
                </section>
              ))
            )
          ) : (
            <>
              <div className="month-head">
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={26} /></button>
                <h3>{parseIso(monthStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={26} /></button>
              </div>
              <div className="month-grid" role="grid" aria-label="Month">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="month-dow">{d}</div>)}
                {gridDays.map((d) => {
                  const inMonth = d >= monthStart && d <= monthEnd;
                  const occ = monthDays[d] ?? [];
                  return (
                    <button key={d} type="button" role="gridcell" aria-selected={d === selected}
                      aria-label={`${dayLabel(d, today)}${occ.length ? `, ${occ.length} event${occ.length > 1 ? 's' : ''}` : ''}`}
                      className={`month-day${inMonth ? '' : ' out'}${d === today ? ' today' : ''}`} onClick={() => setSelected(d)}>
                      <span className="month-num">{parseIso(d).getDate()}</span>
                      <span className="month-dots">
                        {occ.slice(0, 3).map((o) => (
                          <i key={o.event.id} style={{ background: o.event.member_id ? `var(--member-${memberById(o.event.member_id)?.colour ?? 'slate'})` : 'var(--accent)' }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <h3 className="group-label" style={{ marginTop: 'var(--s-4)' }}>{dayLabel(selected, today)}</h3>
              {(monthDays[selected] ?? []).length === 0 ? <p className="muted">Nothing on this day.</p> : (
                <ul className="list">
                  {monthDays[selected].map((o) => <EventRow key={o.event.id} occ={o} who={memberById(o.event.member_id)} onOpen={() => setEditing(o.event)} />)}
                </ul>
              )}
            </>
          )}
      </div>

      {editing && hid && (
        <EventSheet event={'id' in editing ? editing : null} newOn={'newOn' in editing ? editing.newOn : today}
          householdId={hid} myId={me?.id ?? null} members={members}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void live.reload(); }} />
      )}
    </Screen>
  );
}

function EventRow({ occ, who, onOpen }: { occ: Occurrence<CalEvent>; who: Member | null; onOpen: () => void }) {
  const e = occ.event;
  return (
    <li className="row-item">
      <span className="event-time">{eventWhenLabel(e, () => timeLabel(occ.start))}</span>
      <button type="button" className="row-main" onClick={onOpen}>
        <span className="row-title">{e.title}</span>
        {(e.location || e.repeat !== 'none' || (!e.all_day && occ.end)) && (
          <span className="row-meta">
            {!e.all_day && occ.end && <span>until {timeLabel(occ.end)}</span>}
            {e.location && <span><MapPin size={14} /> {e.location}</span>}
            {e.repeat !== 'none' && <span><Repeat size={14} /> {REPEAT_LABEL[e.repeat]}</span>}
          </span>
        )}
      </button>
      <WhoBadge member={who} />
    </li>
  );
}

function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: toIso(d), time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

function EventSheet({ event, newOn, householdId, myId, members, onClose, onSaved }: {
  event: CalEvent | null; newOn: string; householdId: string; myId: string | null; members: Member[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const start = event ? localParts(event.starts_at) : { date: newOn, time: '09:00' };
  const end = event?.ends_at ? localParts(event.ends_at) : null;
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(start.date);
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [from, setFrom] = useState(start.time);
  const [to, setTo] = useState(end?.time ?? '');
  const [who, setWho] = useState<string | null>(event ? event.member_id : null);
  const [repeat, setRepeat] = useState<EventRepeat>(event?.repeat ?? 'none');
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startsAt = allDay ? new Date(`${date}T00:00`) : new Date(`${date}T${from || '00:00'}`);
  const endsAt = !allDay && to ? new Date(`${date}T${to}`) : null;
  const badEnd = endsAt !== null && endsAt < startsAt;

  async function save() {
    setBusy(true);
    const row = {
      title: title.trim(), starts_at: startsAt.toISOString(), ends_at: endsAt ? endsAt.toISOString() : null,
      all_day: allDay, member_id: who, repeat, location: location.trim() || null, notes: notes.trim() || null,
    };
    const { error } = event
      ? await supabase.from('events').update(row).eq('id', event.id)
      : await supabase.from('events').insert({ ...row, household_id: householdId, created_by: myId });
    setBusy(false);
    if (error) toast(friendlyError(error), 'error');
    else { toast(event ? 'Saved' : 'Added to the calendar'); onSaved(); }
  }

  return (
    <>
      <Sheet title={event ? 'Edit event' : 'New event'} onClose={onClose} onSubmit={() => void save()} busy={busy}
        canSubmit={!!title.trim() && !!date && !badEnd} submitLabel={event ? 'Save' : 'Add'}
        footer={event && <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete</button>}>
        <div className="field">
          <label htmlFor="e-title">What</label>
          <input id="e-title" required maxLength={120} autoFocus={!event} placeholder="e.g. Dentist, Mum's birthday" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="e-date">Date</label>
            <input id="e-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="e-repeat">Repeat</label>
            <select id="e-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as EventRepeat)}>
              {(Object.keys(REPEAT_LABEL) as EventRepeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
            </select>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day (birthdays, holidays)</span>
        </label>
        {!allDay && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="e-from">Starts</label>
              <input id="e-from" type="time" required value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-to">Ends (optional)</label>
              <input id="e-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
        {badEnd && <div className="notice notice-warn">The end time is before the start.</div>}
        <div className="field">
          <span className="field-label">Who</span>
          <PersonPicker members={members} value={who} onChange={setWho} label="Who" />
        </div>
        <div className="field">
          <label htmlFor="e-loc">Where (optional)</label>
          <input id="e-loc" maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="e-notes">Notes</label>
          <textarea id="e-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {event && event.repeat !== 'none' && <p className="muted small">Changes apply to every repeat of this event.</p>}
      </Sheet>
      {confirmDelete && event && (
        <ConfirmDialog danger title={`Delete "${event.title}"?`}
          body={event.repeat !== 'none' ? 'This deletes every repeat of it.' : undefined}
          confirmLabel="Delete" onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { error } = await supabase.from('events').delete().eq('id', event.id);
            if (error) toast(friendlyError(error), 'error'); else { toast('Deleted'); onSaved(); }
            setConfirmDelete(false);
          }} />
      )}
    </>
  );
}
