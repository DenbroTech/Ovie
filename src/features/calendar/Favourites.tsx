import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { PersonPicker } from '../../components/PersonPicker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { addDays, dayLabel, parseIso, toIso } from '../../lib/dates';
import { eventsFor, MAX_TIMES, timeText, type FavTime, type Favourite } from '../../lib/favourites';
import type { Member } from '../../lib/types';

/** The + button's first step: a starred favourite (ready to go) or a brand-new event. */
export function FavouriteChooser({ favs, onPick, onNew, onEdit, onClose }: {
  favs: Favourite[]; onPick: (f: Favourite) => void; onNew: () => void; onEdit: (f: Favourite) => void; onClose: () => void;
}) {
  return (
    <Sheet title="Add to the calendar" onClose={onClose}>
      <div className="fav-list">
        {favs.map((f) => (
          <div key={f.id} className="fav-row">
            <button type="button" className="fav-pick" onClick={() => onPick(f)}>
              <Star size={20} className="fav-star" aria-hidden="true" />
              <span className="fav-title">{f.title}</span>
              <span className="muted small">{f.all_day ? 'All day' : f.times.length === 1 ? timeText(f.times[0]) : `${f.times.length} times`}</span>
            </button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label={`Change ${f.title}`} onClick={() => onEdit(f)}><Pencil size={18} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-secondary" onClick={onNew}><Plus size={20} /> New event</button>
    </Sheet>
  );
}

/** Pick a time (a saved one or another), then tap every day it's on. Each day keeps the time it was tapped with. */
export function FavouriteDays({ fav, householdId, myId, today, onClose, onSaved }: {
  fav: Favourite; householdId: string; myId: string | null; today: string; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [time, setTime] = useState<FavTime | null>(fav.all_day ? null : fav.times[0] ?? { label: '', from: '09:00', to: null });
  const [other, setOther] = useState(!fav.all_day && fav.times.length === 0);
  const [otherFrom, setOtherFrom] = useState('09:00');
  const [otherTo, setOtherTo] = useState('');
  const [picks, setPicks] = useState<Record<string, FavTime | null>>({});
  const [monthStart, setMonthStart] = useState(today.slice(0, 8) + '01');
  const [busy, setBusy] = useState(false);

  const current: FavTime | null = fav.all_day ? null : other ? { label: '', from: otherFrom, to: otherTo || null } : time;
  const gridStart = (() => { const d = parseIso(monthStart); return addDays(monthStart, -((d.getDay() + 6) % 7)); })();
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthEnd = toIso(new Date(parseIso(monthStart).getFullYear(), parseIso(monthStart).getMonth() + 1, 0));
  const shift = (n: number) => { const d = parseIso(monthStart); setMonthStart(toIso(new Date(d.getFullYear(), d.getMonth() + n, 1))); };
  const count = Object.keys(picks).length;

  function tap(day: string) {
    setPicks((p) => {
      const next = { ...p };
      const same = day in p && (p[day]?.from ?? null) === (current?.from ?? null) && (p[day]?.to ?? null) === (current?.to ?? null);
      if (same) delete next[day]; else next[day] = current; // tap again to remove, or re-tap with another time to change it
      return next;
    });
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('events').insert(eventsFor(fav, picks, householdId, myId));
    setBusy(false);
    if (error) { toast(friendlyError(error), 'error'); return; }
    toast(`${fav.title} added to ${count} day${count === 1 ? '' : 's'}`);
    onSaved();
  }

  const short = (t: FavTime | null) => (t ? (t.label.trim() || new Date(`2000-01-01T${t.from}`).toLocaleTimeString(undefined, { hour: 'numeric' })) : 'All day');
  return (
    <Sheet title={fav.title} onClose={onClose} onSubmit={() => void save()} busy={busy} canSubmit={count > 0 && (!other || !!otherFrom)}
      submitLabel={count ? `Add ${count} day${count === 1 ? '' : 's'}` : 'Add'}>
      {!fav.all_day && (
        <div className="field">
          <span className="field-label">Time</span>
          <div className="chips" role="radiogroup" aria-label="Time">
            {fav.times.map((t) => (
              <button key={`${t.from}-${t.to}`} type="button" role="radio" className="chip-btn plain"
                aria-checked={!other && time?.from === t.from && time?.to === t.to} onClick={() => { setOther(false); setTime(t); }}>{timeText(t)}</button>
            ))}
            <button type="button" role="radio" className="chip-btn plain" aria-checked={other} onClick={() => setOther(true)}>Other time</button>
          </div>
          {other && (
            <div className="field-row">
              <div className="field"><label htmlFor="fd-from">Starts</label><input id="fd-from" type="time" value={otherFrom} onChange={(e) => setOtherFrom(e.target.value)} /></div>
              <div className="field"><label htmlFor="fd-to">Ends (optional)</label><input id="fd-to" type="time" value={otherTo} onChange={(e) => setOtherTo(e.target.value)} /></div>
            </div>
          )}
        </div>
      )}
      <p className="muted small">Tap each day it's on. Tap a day again to take it off; pick another time first to change a day's time.</p>
      <div className="month-head">
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={24} /></button>
        <h3>{parseIso(monthStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={24} /></button>
      </div>
      <div className="month-grid fav-grid" role="grid" aria-label="Pick days">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="month-dow">{d}</div>)}
        {days.map((d) => {
          const picked = d in picks;
          return (
            <button key={d} type="button" role="gridcell" aria-selected={picked} disabled={d < today}
              aria-label={`${dayLabel(d, today)}${picked ? `, ${short(picks[d])}` : ''}`}
              className={`month-day${d >= monthStart && d <= monthEnd ? '' : ' out'}${d === today ? ' today' : ''}${picked ? ' picked' : ''}`}
              onClick={() => tap(d)}>
              <span className="month-num">{parseIso(d).getDate()}</span>
              {picked && <span className="fav-pick-label">{short(picks[d])}</span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Change a favourite: its name, who, where, notes and saved times. */
export function FavouriteEdit({ fav, members, onClose, onSaved }: { fav: Favourite; members: Member[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(fav.title);
  const [who, setWho] = useState<string | null>(fav.member_id);
  const [location, setLocation] = useState(fav.location ?? '');
  const [notes, setNotes] = useState(fav.notes ?? '');
  const [allDay, setAllDay] = useState(fav.all_day);
  const [times, setTimes] = useState<FavTime[]>(fav.times);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setAt = (i: number, patch: Partial<FavTime>) => setTimes((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  async function save() {
    setBusy(true);
    const clean = allDay ? [] : times.filter((t) => t.from).map((t) => ({ label: t.label.trim(), from: t.from, to: t.to || null }));
    const { error } = await supabase.from('event_favourites').update({
      title: title.trim(), member_id: who, location: location.trim() || null, notes: notes.trim() || null, all_day: allDay, times: clean,
    }).eq('id', fav.id);
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast('Saved'); onSaved(); }
  }

  return (
    <>
      <Sheet title="Favourite" onClose={onClose} onSubmit={() => void save()} busy={busy} canSubmit={!!title.trim()}
        footer={<button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete</button>}>
        <div className="field"><label htmlFor="fe-title">What</label>
          <input id="fe-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><span className="field-label">Who</span><PersonPicker members={members} value={who} onChange={setWho} label="Who" /></div>
        <label className="check"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /><span>All day</span></label>
        {!allDay && (
          <div className="field">
            <span className="field-label">Saved times</span>
            {times.map((t, i) => (
              <div key={i} className="fav-time-row">
                <input aria-label="Name (e.g. Early)" placeholder="Name (e.g. Early)" maxLength={30} value={t.label} onChange={(e) => setAt(i, { label: e.target.value })} />
                <input aria-label="Starts" type="time" value={t.from} onChange={(e) => setAt(i, { from: e.target.value })} />
                <input aria-label="Ends" type="time" value={t.to ?? ''} onChange={(e) => setAt(i, { to: e.target.value || null })} />
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove this time" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))}><X size={18} /></button>
              </div>
            ))}
            {times.length < MAX_TIMES && (
              <button type="button" className="btn btn-secondary" onClick={() => setTimes((ts) => [...ts, { label: '', from: '09:00', to: '17:00' }])}><Plus size={18} /> Add a time</button>
            )}
          </div>
        )}
        <div className="field"><label htmlFor="fe-loc">Where (optional)</label>
          <input id="fe-loc" maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div className="field"><label htmlFor="fe-notes">Notes</label>
          <textarea id="fe-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </Sheet>
      {confirmDelete && (
        <ConfirmDialog danger title={`Delete the favourite "${fav.title}"?`} body="Days already on the calendar stay there." confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { error } = await supabase.from('event_favourites').delete().eq('id', fav.id);
            if (error) toast(friendlyError(error), 'error'); else { toast('Favourite deleted'); onSaved(); }
            setConfirmDelete(false);
          }} />
      )}
    </>
  );
}
