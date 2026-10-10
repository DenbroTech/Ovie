import { useEffect, useRef, useState } from 'react';
import { AlarmClock, Plus, Trash2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { PersonPicker, WhoBadge } from '../../components/PersonPicker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { OvieSheep } from '../../components/OvieSheep';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';
import { daysLabel, nextOccurrence, ringingOccurrence, type AlarmLike } from '../../lib/alarms';
import { dayLabel, toIso, todayIso } from '../../lib/dates';
import type { Member } from '../../lib/types';

export interface Alarm extends AlarmLike {
  label: string;
  member_id: string | null;
}
const COLS = 'id,label,at_time,days,on_date,member_id,enabled,last_dismissed_for,snoozed_until';
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export function useAlarms(householdId: string | undefined) {
  return useLive<Alarm[]>('alarms', householdId, ['alarms'], () =>
    supabase.from('alarms').select(COLS).eq('household_id', householdId!).order('at_time'));
}

export function AlarmsScreen() {
  const { household, members, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const hid = household?.id;
  const live = useAlarms(hid);
  const [editing, setEditing] = useState<Alarm | 'new' | null>(null);
  const today = todayIso(household?.timezone);
  const now = new Date();
  const alarms = live.data ?? [];

  async function toggle(a: Alarm) {
    live.setData((rows) => rows?.map((r) => (r.id === a.id ? { ...r, enabled: !a.enabled } : r)) ?? rows);
    // switching a finished one-off back on: move it to the next time that hour comes round
    const patch: Partial<Alarm> = { enabled: !a.enabled, snoozed_until: null };
    if (!a.enabled && a.days.length === 0 && a.on_date && !nextOccurrence({ ...a, enabled: true }, now)) {
      const t = new Date(); const [h, m] = a.at_time.split(':').map(Number); t.setHours(h, m, 0, 0);
      if (t <= now) t.setDate(t.getDate() + 1);
      patch.on_date = toIso(t);
    }
    const { error } = await supabase.from('alarms').update(patch).eq('id', a.id);
    if (error) { toast(friendlyError(error), 'error'); void live.reload(); }
  }

  return (
    <Screen title="Alarms" actions={
      <button type="button" className="btn btn-primary btn-icon" aria-label="New alarm" disabled={!online} onClick={() => setEditing('new')}>
        <Plus size={26} />
      </button>
    }>
      <div className="module">
        <p className="muted small" style={{ marginBottom: 'var(--s-3)' }}>
          Alarms flash on the wall screen (and on the phone of the person they're for, while Ovie is open). Stopping it anywhere stops it everywhere.
        </p>
        {live.error ? <LoadError message={live.error} onRetry={() => void live.reload()} />
          : live.loading ? <Spinner />
          : alarms.length === 0 ? <Empty title="No alarms">Tap + for reminders like “Bins out” or “Pick up Lina”.</Empty> : (
            <ul className="list">
              {alarms.map((a) => {
                const next = nextOccurrence(a, now);
                return (
                  <li key={a.id} className={`row-item${a.enabled ? '' : ' is-off'}`}>
                    <button type="button" className="row-main" onClick={() => setEditing(a)}>
                      <span className="alarm-time">{hhmm(a.at_time)}</span>
                      <span className="row-title">{a.label}</span>
                      <span className="row-meta">
                        {daysLabel(a.days, a.on_date)}
                        {next && <span>Next: {dayLabel(toIso(next), today)}</span>}
                      </span>
                    </button>
                    <WhoBadge member={members.find((m) => m.id === a.member_id) ?? null} />
                    <button type="button" role="switch" aria-checked={a.enabled} aria-label={`${a.label} on`} className="switch"
                      disabled={!online} onClick={() => void toggle(a)}><span /></button>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
      {editing && hid && (
        <AlarmSheet alarm={editing === 'new' ? null : editing} householdId={hid} myId={me?.id ?? null} members={members}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void live.reload(); }} />
      )}
    </Screen>
  );
}

function AlarmSheet({ alarm, householdId, myId, members, onClose, onSaved }: {
  alarm: Alarm | null; householdId: string; myId: string | null; members: Member[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [label, setLabel] = useState(alarm?.label ?? '');
  const [time, setTime] = useState(alarm?.at_time.slice(0, 5) ?? '07:00');
  const [repeat, setRepeat] = useState(alarm ? alarm.days.length > 0 : true);
  const [days, setDays] = useState<number[]>(alarm?.days.length ? alarm.days : [1, 2, 3, 4, 5]);
  const [who, setWho] = useState<string | null>(alarm ? alarm.member_id : null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function nextDateFor(t: string): string {
    const d = new Date(); const [h, m] = t.split(':').map(Number); d.setHours(h, m, 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1);
    return toIso(d);
  }

  async function save() {
    setBusy(true);
    const row = {
      label: label.trim(), at_time: time, member_id: who, enabled: true, snoozed_until: null,
      days: repeat ? days : [], on_date: repeat ? null : nextDateFor(time),
    };
    const { error } = alarm
      ? await supabase.from('alarms').update(row).eq('id', alarm.id)
      : await supabase.from('alarms').insert({ ...row, household_id: householdId, created_by: myId });
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast(alarm ? 'Alarm saved' : 'Alarm set'); onSaved(); }
  }

  return (
    <>
      <Sheet title={alarm ? 'Edit alarm' : 'New alarm'} onClose={onClose} onSubmit={() => void save()} busy={busy}
        canSubmit={!!label.trim() && !!time && (!repeat || days.length > 0)} submitLabel={alarm ? 'Save' : 'Set alarm'}
        footer={alarm && <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete</button>}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="a-time">Time</label>
            <input id="a-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="time-big" />
          </div>
          <div className="field">
            <label htmlFor="a-label">What for</label>
            <input id="a-label" required maxLength={60} autoFocus={!alarm} placeholder="e.g. Bins out" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Repeat">
          <button type="button" aria-pressed={repeat} onClick={() => setRepeat(true)}>Repeat</button>
          <button type="button" aria-pressed={!repeat} onClick={() => setRepeat(false)}>Just once</button>
        </div>
        {repeat ? (
          <div className="chips" role="group" aria-label="Days">
            {WEEK.map((d) => (
              <button key={d} type="button" className="chip-btn plain day-chip" aria-pressed={days.includes(d)}
                onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}>{DAY[d]}</button>
            ))}
          </div>
        ) : <p className="muted small">Goes off the next time it's {time ? hhmm(time) : 'that time'}.</p>}
        <div className="field">
          <span className="field-label">For</span>
          <PersonPicker members={members} value={who} onChange={setWho} label="For" />
        </div>
      </Sheet>
      {confirmDelete && alarm && (
        <ConfirmDialog danger title={`Delete “${alarm.label}”?`} confirmLabel="Delete" onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { error } = await supabase.from('alarms').delete().eq('id', alarm.id);
            if (error) toast(friendlyError(error), 'error'); else { toast('Deleted'); onSaved(); }
            setConfirmDelete(false);
          }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The ringing alarm: full screen, flashing, with Ovie. Lives above every screen.
// ---------------------------------------------------------------------------

function beep(ctx: AudioContext) {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t + i * 0.3);
    g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.3 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.3);
    o.stop(t + i * 0.3 + 0.22);
  }
}

export function AlarmRinger() {
  const { household, thisDevice, me } = useHousehold();
  const live = useAlarms(household?.id);
  const [now, setNow] = useState(() => new Date());
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const isWall = thisDevice?.kind === 'wall';
  const ringing = (live.data ?? []).filter((a) =>
    (isWall || a.member_id === null || a.member_id === me?.id) && ringingOccurrence(a, now));
  const top = ringing[0];

  useEffect(() => {
    if (!top) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      beep(audio.current);
      const id = window.setInterval(() => audio.current && beep(audio.current), 2000);
      return () => window.clearInterval(id);
    } catch {
      return undefined; // no sound allowed here; the flashing screen still shows
    }
  }, [top?.id]);

  if (!top) return null;
  const occ = ringingOccurrence(top, now)!;

  async function stop() {
    const patch: Partial<Alarm> = { last_dismissed_for: occ.toISOString(), snoozed_until: null };
    if (top.days.length === 0) patch.enabled = false;
    live.setData((rows) => rows?.map((r) => (r.id === top.id ? { ...r, ...patch } : r)) ?? rows);
    await supabase.from('alarms').update(patch).eq('id', top.id);
  }
  async function snooze() {
    const until = new Date(Date.now() + 9 * 60_000).toISOString();
    live.setData((rows) => rows?.map((r) => (r.id === top.id ? { ...r, snoozed_until: until } : r)) ?? rows);
    await supabase.from('alarms').update({ snoozed_until: until }).eq('id', top.id);
  }

  return (
    <div className="alarm-ring" role="alertdialog" aria-modal="true" aria-label={`Alarm: ${top.label}`}>
      <div className="alarm-flash" aria-hidden="true" />
      <div className="alarm-content">
        <div className="alarm-sheep"><OvieSheep size={140} /></div>
        <AlarmClock size={56} className="alarm-icon" aria-hidden="true" />
        <div className="alarm-clock">{hhmm(top.at_time)}</div>
        <div className="alarm-label">{top.label}</div>
        {ringing.length > 1 && <div className="alarm-more">+{ringing.length - 1} more</div>}
        <div className="alarm-buttons">
          <button type="button" className="btn alarm-snooze" onClick={() => void snooze()}>Snooze 9 min</button>
          <button type="button" className="btn alarm-stop" onClick={() => void stop()}>Stop</button>
        </div>
      </div>
    </div>
  );
}
