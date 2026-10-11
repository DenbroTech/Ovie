import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Copy, Laptop, Minus, Monitor, Pencil, Plus, Power, RefreshCw, RotateCcw, Smartphone, Trash2, UserPlus, Unlink } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { DEFAULT_NIGHT, useThemeChoice } from '../../app/theme';
import { SCREENSAVER_CHOICES, screensaverMinutes, setScreensaverMinutes } from '../screensaver/Screensaver';
import { supabase } from '../../lib/supabase';
import { DEFAULT_FRAME, FRAME_MAX, FRAME_STEP, setFrame, storedFrame, type FrameEdge } from '../../lib/frame';
import { friendlyError } from '../../lib/errors';
import { MEMBER_COLOURS, type Device, type Member, type ThemePref } from '../../lib/types';

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

function lastSeen(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 10) return 'in use now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The Pi kiosk's local helper (scripts/pi/helper.py) — only reachable on the Pi itself. */
export const DESKTOP_HELPER_URL = 'http://127.0.0.1:8765/exit';
export const SHUTDOWN_HELPER_URL = 'http://127.0.0.1:8765/shutdown';
export const RESTART_HELPER_URL = 'http://127.0.0.1:8765/restart';

type Confirm =
  | { kind: 'desktop' }
  | { kind: 'shutdown' }
  | { kind: 'restart' }
  | { kind: 'code' }
  | { kind: 'remove-person'; member: Member }
  | { kind: 'unpair'; device: Device; self: boolean };

export function SettingsScreen() {
  const { household, members, devices, thisDevice, me, refresh } = useHousehold();
  const { online } = useConnection();
  const { theme, setTheme } = useThemeChoice();
  const toast = useToast();

  const [householdName, setHouseholdName] = useState(household?.name ?? '');
  const [editing, setEditing] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [ssMins, setSsMins] = useState(() => screensaverMinutes(thisDevice?.kind === 'wall'));

  useEffect(() => setHouseholdName(household?.name ?? ''), [household?.name]);
  const zones = useMemo(timeZones, []);
  const disabled = !online || busy;

  if (!household || !thisDevice) return null;

  async function run(fn: () => PromiseLike<{ error: unknown }>, success?: string): Promise<boolean> {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      await refresh();
      if (success) toast(success);
      return true;
    } catch (err) {
      toast(friendlyError(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const st = household.settings as { dark_from?: string; dark_until?: string };
  const darkFrom = st.dark_from ?? DEFAULT_NIGHT.from;
  const darkUntil = st.dark_until ?? DEFAULT_NIGHT.until;
  const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const nightLabel = `${fmt(darkFrom)} to ${fmt(darkUntil)}`;
  const saveNight = (patch: { dark_from?: string; dark_until?: string }) =>
    run(() => supabase.from('households').update({ settings: { ...household.settings, ...patch } }).eq('id', household.id), 'Night hours saved');

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.display_name;

  return (
    <Screen title="Settings" sheep="settings">
      <div className="settings-grid">
        <section className="card stack" aria-labelledby="dev-h">
          <h2 id="dev-h">This device</h2>
          <div className="row">
            {thisDevice.kind === 'wall' ? <Monitor size={28} /> : <Smartphone size={28} />}
            <div>
              <strong>{thisDevice.label}</strong>
              <div className="muted small">
                {thisDevice.kind === 'wall' ? 'Shared wall screen' : me ? `Belongs to ${me.display_name}` : 'Shared device'}
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="who">Who uses this device?</label>
            <select id="who" disabled={disabled} value={thisDevice.kind === 'wall' ? 'wall' : thisDevice.member_id ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                const patch = v === 'wall' ? { kind: 'wall', member_id: null } : { kind: 'personal', member_id: v || null };
                void run(() => supabase.from('devices').update(patch).eq('id', thisDevice.id), 'Saved');
              }}>
              {thisDevice.kind !== 'wall' && !thisDevice.member_id && <option value="">Shared</option>}
              {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              <option value="wall">Everyone (wall screen)</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">Theme on this device</span>
            <div className="segmented" role="group" aria-label="Theme">
              {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
                <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                  {t === 'system' ? 'Automatic' : t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
            {theme === 'system' && <span className="hint">Automatic: dark at night ({nightLabel}), light in the day. Change the hours under Home.</span>}
          </div>
          <div className="field">
            <label htmlFor="ss">Screensaver</label>
            <select id="ss" value={ssMins} onChange={(e) => { const n = Number(e.target.value); setSsMins(n); setScreensaverMinutes(n); }}>
              {SCREENSAVER_CHOICES.map((n) => <option key={n} value={n}>{n === 0 ? 'Off' : `After ${n} minute${n === 1 ? '' : 's'} of no touching`}</option>)}
            </select>
            <span className="hint">Shows photos and today's info. Tap to come back.</span>
          </div>
          {thisDevice.kind === 'wall' && <FrameFit />}
          {thisDevice.kind === 'wall' && (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirm({ kind: 'desktop' })}>
              <Laptop size={20} /> Switch to the desktop
            </button>
          )}
          {thisDevice.kind === 'wall' && (
            <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm({ kind: 'restart' })}>
                <RotateCcw size={20} /> Restart the Pi
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm({ kind: 'shutdown' })}>
                <Power size={20} /> Shut down the Pi
              </button>
            </div>
          )}
          <button type="button" className="btn btn-secondary" disabled={disabled}
            onClick={() => setConfirm({ kind: 'unpair', device: thisDevice, self: true })}>
            <Unlink size={20} /> Remove this device from Ovie
          </button>
          <p className="muted small">Ovie version {__BUILD_ID__}</p>
        </section>

        <section className="card stack" aria-labelledby="people-h">
          <h2 id="people-h">People</h2>
          <ul className="member-list">
            {members.map((m) => (
              <li key={m.id} className="row">
                <Avatar member={m} />
                <strong style={{ flex: 1 }}>{m.display_name}</strong>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${m.display_name}`}
                  disabled={disabled} onClick={() => setEditing(m)}>
                  <Pencil size={20} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${m.display_name}`}
                  disabled={disabled || members.length === 1} onClick={() => setConfirm({ kind: 'remove-person', member: m })}>
                  <Trash2 size={20} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setAdding(true)}>
            <UserPlus size={20} /> Add a person
          </button>
        </section>

        <section className="card stack" aria-labelledby="hh-h">
          <h2 id="hh-h">Home</h2>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void run(() => supabase.from('households').update({ name: householdName.trim() }).eq('id', household.id), 'Saved'); }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="hn">Name</label>
              <input id="hn" required maxLength={80} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            </div>
            <button className="btn btn-secondary" style={{ alignSelf: 'end' }}
              disabled={disabled || householdName.trim() === household.name || !householdName.trim()}>Save</button>
          </form>
          {zones.length > 0 && (
            <div className="field">
              <label htmlFor="tz">Time zone</label>
              <select id="tz" value={household.timezone} disabled={disabled}
                onChange={(e) => void run(() => supabase.from('households').update({ timezone: e.target.value }).eq('id', household.id), 'Time zone saved')}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <span className="field-label">Night (dark) hours for “Automatic”</span>
            <div className="field-row">
              <div className="field">
                <label htmlFor="dark-from">Dark from</label>
                <input id="dark-from" type="time" value={darkFrom} disabled={disabled}
                  onChange={(e) => e.target.value && void saveNight({ dark_from: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="dark-until">Light again at</label>
                <input id="dark-until" type="time" value={darkUntil} disabled={disabled}
                  onChange={(e) => e.target.value && void saveNight({ dark_until: e.target.value })} />
              </div>
            </div>
            <span className="hint">Every screen set to Automatic follows these times.</span>
          </div>
          <div className="field">
            <span className="field-label">Home code</span>
            <div className="row">
              <code className="invite-code">{household.invite_code}</code>
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Copy home code"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(household.invite_code); toast('Copied'); }
                  catch { toast('Could not copy. Write it down instead.', 'error'); }
                }}>
                <Copy size={20} />
              </button>
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Make a new home code"
                disabled={disabled} onClick={() => setConfirm({ kind: 'code' })}>
                <RefreshCw size={20} />
              </button>
            </div>
            <span className="hint">Type this on a new phone or screen to add it. Keep it private: it is the key to your home's data.</span>
          </div>
        </section>

        <section className="card stack" aria-labelledby="devs-h">
          <h2 id="devs-h">Devices</h2>
          <ul className="member-list">
            {devices.map((d) => (
              <li key={d.id} className="row">
                {d.kind === 'wall' ? <Monitor size={24} /> : <Smartphone size={24} />}
                <div style={{ flex: 1 }}>
                  <div><strong>{d.label}</strong>{d.id === thisDevice.id && <span className="muted"> (this one)</span>}</div>
                  <div className="muted small">
                    {d.kind === 'wall' ? 'Everyone' : memberName(d.member_id) ?? 'Shared'} · {lastSeen(d.last_seen_at)}
                  </div>
                </div>
                {d.id !== thisDevice.id && (
                  <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${d.label}`}
                    disabled={disabled} onClick={() => setConfirm({ kind: 'unpair', device: d, self: false })}>
                    <Unlink size={20} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="muted small">Lost a phone? Remove it here and it loses access straight away.</p>
        </section>
      </div>

      {(editing || adding) && (
        <PersonDialog
          person={editing}
          busy={busy}
          onCancel={() => { setEditing(null); setAdding(false); }}
          onSave={async (name, colour) => {
            const ok = editing
              ? await run(() => supabase.from('members').update({ display_name: name, colour }).eq('id', editing.id), 'Saved')
              : await run(() => supabase.from('members').insert({ household_id: household.id, display_name: name, colour }), `${name} added`);
            if (ok) { setEditing(null); setAdding(false); }
          }}
        />
      )}

      {confirm?.kind === 'desktop' && (
        <ConfirmDialog title="Switch to the desktop?"
          body="Ovie closes so you can use the Raspberry Pi as a normal computer. To come back, tap the Ovie icon on the desktop, or restart the Pi."
          confirmLabel="Switch" onCancel={() => setConfirm(null)}
          onConfirm={() => { window.location.href = DESKTOP_HELPER_URL; }} />
      )}
      {confirm?.kind === 'shutdown' && (
        <ConfirmDialog title="Shut down the Pi?"
          body="Wait until the screen goes dark and the Pi's green light stops flashing (about 20 seconds), then switch off the power at the wall."
          confirmLabel="Shut down" onCancel={() => setConfirm(null)}
          onConfirm={() => { window.location.href = SHUTDOWN_HELPER_URL; }} />
      )}
      {confirm?.kind === 'restart' && (
        <ConfirmDialog title="Restart the Pi?"
          body="The screen goes dark for about a minute, then Ovie comes back by itself."
          confirmLabel="Restart" onCancel={() => setConfirm(null)}
          onConfirm={() => { window.location.href = RESTART_HELPER_URL; }} />
      )}
      {confirm?.kind === 'code' && (
        <ConfirmDialog title="Make a new home code?"
          body="The old code stops working. Devices that are already set up keep working."
          confirmLabel="New code" onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run(() => supabase.rpc('regenerate_invite_code', { p_household_id: household.id }), 'New code ready');
            setConfirm(null);
          }} />
      )}
      {confirm?.kind === 'remove-person' && (
        <ConfirmDialog danger title={`Remove ${confirm.member.display_name}?`}
          body="Their devices stay set up as shared devices. You can add them again later."
          confirmLabel="Remove" onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run(() => supabase.from('members').delete().eq('id', confirm.member.id), 'Removed');
            setConfirm(null);
          }} />
      )}
      {confirm?.kind === 'unpair' && (
        <ConfirmDialog danger title={confirm.self ? 'Remove this device?' : `Remove ${confirm.device.label}?`}
          body={confirm.self
            ? 'This device will need the home code to use Ovie again.'
            : 'It loses access straight away and will need the home code to come back.'}
          confirmLabel="Remove" onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run(() => supabase.from('devices').delete().eq('id', confirm.device.id), 'Device removed');
            setConfirm(null);
          }} />
      )}
    </Screen>
  );
}

function PersonDialog({
  person, busy, onSave, onCancel,
}: {
  person: Member | null;
  busy: boolean;
  onSave: (name: string, colour: Member['colour']) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(person?.display_name ?? '');
  const [colour, setColour] = useState<Member['colour']>(person?.colour ?? 'sky');
  const submit = (e: FormEvent) => { e.preventDefault(); if (name.trim()) onSave(name.trim(), colour); };
  return (
    <div className="overlay" onClick={() => !busy && onCancel()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="person-title"
        onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 id="person-title">{person ? `Edit ${person.display_name}` : 'Add a person'}</h2>
        <div className="field">
          <label htmlFor="pn">Name</label>
          <input id="pn" required maxLength={40} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label">Colour</span>
          <div className="swatches" role="radiogroup" aria-label="Colour">
            {MEMBER_COLOURS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={colour === c} aria-label={c}
                className="swatch" style={{ background: `var(--member-${c})` }} onClick={() => setColour(c)} />
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}

const EDGES: Array<[FrameEdge, string]> = [['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['bottom', 'Bottom']];

/** Nudge each edge in until nothing is hidden behind the picture frame. Changes show straight away. */
function FrameFit() {
  const [frame, setLocal] = useState(storedFrame);
  const nudge = (edge: FrameEdge, by: number) => setLocal(setFrame({ ...frame, [edge]: frame[edge] + by }));
  return (
    <div className="field">
      <span className="field-label">Fit to frame</span>
      <div className="frame-fit">
        {EDGES.map(([edge, label]) => (
          <div key={edge} className="frame-fit-row">
            <span>{label}</span>
            <button type="button" className="btn btn-secondary frame-fit-btn" aria-label={`Move the ${edge} edge out`}
              disabled={frame[edge] <= 0} onClick={() => nudge(edge, -FRAME_STEP)}><Minus size={20} /></button>
            <output aria-label={`${label} edge`}>{frame[edge]}</output>
            <button type="button" className="btn btn-secondary frame-fit-btn" aria-label={`Move the ${edge} edge in`}
              disabled={frame[edge] >= FRAME_MAX} onClick={() => nudge(edge, FRAME_STEP)}><Plus size={20} /></button>
          </div>
        ))}
      </div>
      <span className="hint">If the frame hides part of the screen, tap + on that side until everything shows.{' '}
        <button type="button" className="btn-link" onClick={() => setLocal(setFrame(DEFAULT_FRAME))}>Reset</button>
      </span>
    </div>
  );
}
