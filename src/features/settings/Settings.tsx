import { useEffect, useMemo, useState } from 'react';
import { Copy, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useAuth } from '../../app/AuthProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { applyTheme } from '../../app/theme';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { MEMBER_COLOURS, type Member, type ThemePref } from '../../lib/types';


const ROLE_LABEL: Record<Member['role'], string> = { owner: 'Owner', adult: 'Adult', device: 'Wall screen' };

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

export function SettingsScreen() {
  const { household, members, me, refresh } = useHousehold();
  const { session } = useAuth();
  const { online } = useConnection();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [householdName, setHouseholdName] = useState(household?.name ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'signout' } | { kind: 'remove'; member: Member } | { kind: 'code' }>(null);

  useEffect(() => setDisplayName(me?.display_name ?? ''), [me?.display_name]);
  useEffect(() => setHouseholdName(household?.name ?? ''), [household?.name]);

  const zones = useMemo(timeZones, []);
  const isOwner = me?.role === 'owner';
  const theme: ThemePref = me?.prefs.theme ?? 'system';
  const disabled = !online || busy !== null;

  if (!household || !me) return null;

  async function run(label: string, fn: () => PromiseLike<{ error: unknown }>, success?: string) {
    setBusy(label);
    try {
      const { error } = await fn();
      if (error) throw error;
      await refresh();
      if (success) toast(success);
    } catch (err) {
      toast(friendlyError(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  const updateMe = (patch: Partial<Member>, success?: string) =>
    run('me', () => supabase.from('members').update(patch).eq('id', me.id), success);

  const updateHousehold = (patch: Record<string, unknown>, success?: string) =>
    run('household', () => supabase.from('households').update(patch).eq('id', household.id), success);

  return (
    <Screen title="Settings">
      <div className="settings-grid">
        <section className="card stack" aria-labelledby="you-h">
          <h2 id="you-h">You</h2>
          <div className="row">
            <Avatar member={{ display_name: displayName || me.display_name, colour: me.colour }} size={56} />
            <div className="muted small">{session?.user.email}</div>
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void updateMe({ display_name: displayName.trim() }, 'Name saved'); }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="dn">Name</label>
              <input id="dn" required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <button className="btn btn-secondary" style={{ alignSelf: 'end' }} disabled={disabled || displayName.trim() === me.display_name || !displayName.trim()}>
              Save
            </button>
          </form>
          <div className="field">
            <span className="field-label">Colour</span>
            <div className="swatches" role="radiogroup" aria-label="Your colour">
              {MEMBER_COLOURS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={me.colour === c} aria-label={c}
                  className="swatch" style={{ background: `var(--member-${c})` }}
                  disabled={disabled} onClick={() => void updateMe({ colour: c })} />
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Theme</span>
            <div className="segmented" role="group" aria-label="Theme">
              {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
                <button key={t} type="button" aria-pressed={theme === t} disabled={disabled}
                  onClick={() => { applyTheme(t); void updateMe({ prefs: { ...me.prefs, theme: t } }); }}>
                  {t === 'system' ? 'Automatic' : t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card stack" aria-labelledby="hh-h">
          <h2 id="hh-h">Household</h2>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void updateHousehold({ name: householdName.trim() }, 'Household renamed'); }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="hn">Name</label>
              <input id="hn" required maxLength={80} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            </div>
            <button className="btn btn-secondary" style={{ alignSelf: 'end' }} disabled={disabled || householdName.trim() === household.name || !householdName.trim()}>
              Save
            </button>
          </form>
          {zones.length > 0 && (
            <div className="field">
              <label htmlFor="tz">Time zone</label>
              <select id="tz" value={household.timezone} disabled={disabled}
                onChange={(e) => void updateHousehold({ timezone: e.target.value }, 'Time zone saved')}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <span className="field-label">Invite code</span>
            <div className="row invite">
              <code className="invite-code">{household.invite_code}</code>
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Copy invite code"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(household.invite_code); toast('Copied'); }
                  catch { toast('Could not copy — write it down instead', 'error'); }
                }}>
                <Copy size={20} />
              </button>
              {isOwner && (
                <button type="button" className="btn btn-secondary btn-icon" aria-label="Make a new invite code"
                  disabled={disabled} onClick={() => setConfirm({ kind: 'code' })}>
                  <RefreshCw size={20} />
                </button>
              )}
            </div>
            <span className="hint">Use this code to add another person or the wall screen.</span>
          </div>
          <div className="stack">
            <span className="field-label">People and screens</span>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.id} className="row">
                  <Avatar member={m} />
                  <div style={{ flex: 1 }}>
                    <div><strong>{m.display_name}</strong>{m.id === me.id && <span className="muted"> (you)</span>}</div>
                    <div className="muted small">{ROLE_LABEL[m.role]}</div>
                  </div>
                  {isOwner && m.id !== me.id && (
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${m.display_name}`}
                      disabled={disabled} onClick={() => setConfirm({ kind: 'remove', member: m })}>
                      <Trash2 size={20} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card stack" aria-labelledby="dev-h">
          <h2 id="dev-h">This device</h2>
          <p className="muted small">
            Signed in as {session?.user.email}. {me.role === 'device' ? 'This screen stays signed in until you sign it out.' : ''}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirm({ kind: 'signout' })}>
            <LogOut size={20} /> Sign out
          </button>
          <p className="muted small">Ovie version {__BUILD_ID__}</p>
        </section>
      </div>

      {confirm?.kind === 'signout' && (
        <ConfirmDialog title="Sign out of Ovie?" body={me.role === 'device' ? 'The wall screen will need the kiosk email and password to sign back in.' : undefined}
          confirmLabel="Sign out" onCancel={() => setConfirm(null)}
          onConfirm={async () => { await supabase.auth.signOut(); setConfirm(null); }} />
      )}
      {confirm?.kind === 'code' && (
        <ConfirmDialog title="Make a new invite code?" body="The old code will stop working. People already in the household are not affected."
          confirmLabel="New code" onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run('code', () => supabase.rpc('regenerate_invite_code', { p_household_id: household.id }), 'New invite code ready');
            setConfirm(null);
          }} />
      )}
      {confirm?.kind === 'remove' && (
        <ConfirmDialog danger title={`Remove ${confirm.member.display_name}?`}
          body="They will no longer see this household. Their login is not deleted and they can rejoin with the invite code."
          confirmLabel="Remove" onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run('remove', () => supabase.from('members').delete().eq('id', confirm.member.id), 'Removed');
            setConfirm(null);
          }} />
      )}
    </Screen>
  );
}
