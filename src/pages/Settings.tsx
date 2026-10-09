import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LogOut, Palette, Home, UserRound, Users, Trash2, Plus, MonitorSmartphone } from 'lucide-react';
import { useOvieClient } from '../lib/OvieContext';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold } from '../household/HouseholdProvider';
import { applyTheme } from '../lib/theme';
import { MEMBER_COLOURS, type HouseholdInvite, type HouseholdMember, type ThemePref } from '../lib/db-types';
import { PageHeader } from '../shell/PageHeader';
import { Avatar, memberColourStyle } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TextField } from '../ui/Field';
import { Segmented } from '../ui/Segmented';
import { ErrorNotice, Spinner } from '../ui/States';
import { useToast } from '../ui/Toast';
import { friendlyError } from '../lib/errors';

const THEMES = [
  { value: 'system', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const WEEK_STARTS = [
  { value: '1', label: 'Monday' },
  { value: '0', label: 'Sunday' },
] as const;

export function Settings() {
  const { me } = useHousehold();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="settings-grid">
        <AppearanceCard />
        <YouCard />
        <HouseholdCard />
        <MembersCard />
        {me.role === 'owner' && <InvitesCard />}
        <DeviceCard />
      </div>
    </>
  );
}

function AppearanceCard() {
  const client = useOvieClient();
  const toast = useToast();
  const { mySettings, reload } = useHousehold();
  const [theme, setTheme] = useState<ThemePref>(mySettings.theme);

  async function change(next: ThemePref) {
    const prev = theme;
    setTheme(next);
    applyTheme(next);
    const { error } = await client
      .from('member_settings')
      .update({ theme: next })
      .eq('household_id', mySettings.household_id)
      .eq('user_id', mySettings.user_id);
    if (error) {
      setTheme(prev);
      applyTheme(prev);
      toast.show(friendlyError(error), { tone: 'error' });
    } else {
      void reload();
    }
  }

  return (
    <Card title="Appearance" icon={<Palette size={20} aria-hidden="true" />}>
      <Segmented label="Theme" value={theme} options={THEMES} onChange={change} />
      <p className="field__hint">Saved for this account, so each screen and phone can differ.</p>
    </Card>
  );
}

function YouCard() {
  const client = useOvieClient();
  const toast = useToast();
  const { me, reload } = useHousehold();
  const [name, setName] = useState(me.display_name);
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Pick<HouseholdMember, 'display_name' | 'colour'>>) {
    setBusy(true);
    const { error } = await client
      .from('household_members')
      .update(patch)
      .eq('household_id', me.household_id)
      .eq('user_id', me.user_id);
    setBusy(false);
    if (error) toast.show(friendlyError(error), { tone: 'error' });
    else {
      toast.show('Saved');
      await reload();
    }
  }

  return (
    <Card title={me.role === 'device' ? 'This screen' : 'You'} icon={<UserRound size={20} aria-hidden="true" />}>
      <form
        className="stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== me.display_name) void save({ display_name: name.trim() });
        }}
      >
        <TextField label="Name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <Button type="submit" variant="secondary" busy={busy} disabled={!name.trim() || name.trim() === me.display_name}>
            Save name
          </Button>
        </div>
      </form>
      <div className="field">
        <span className="field__label" id="colour-label">
          Colour
        </span>
        <div className="swatches" role="group" aria-labelledby="colour-label">
          {MEMBER_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              aria-label={c}
              aria-pressed={me.colour === c}
              disabled={busy}
              style={{ ...memberColourStyle(c), background: 'var(--m-fg)' }}
              onClick={() => me.colour !== c && void save({ colour: c })}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function HouseholdCard() {
  const client = useOvieClient();
  const toast = useToast();
  const { household, settings, me, reload } = useHousehold();
  const isOwner = me.role === 'owner';
  const canEditSettings = me.role !== 'device';
  const [name, setName] = useState(household.name);
  const [tz, setTz] = useState(household.timezone);
  const [busy, setBusy] = useState(false);
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

  async function saveHousehold(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await client.from('households').update({ name: name.trim(), timezone: tz.trim() }).eq('id', household.id);
    setBusy(false);
    if (error) toast.show(friendlyError(error), { tone: 'error' });
    else {
      toast.show('Household saved');
      await reload();
    }
  }

  async function setWeekStart(v: string) {
    const { error } = await client
      .from('household_settings')
      .update({ week_starts_on: Number(v) })
      .eq('household_id', household.id);
    if (error) toast.show(friendlyError(error), { tone: 'error' });
    else await reload();
  }

  return (
    <Card title="Household" icon={<Home size={20} aria-hidden="true" />}>
      {isOwner ? (
        <form className="stack" onSubmit={saveHousehold}>
          <TextField label="Household name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Time zone"
            list="ovie-timezones"
            value={tz}
            hint="Used for “today”, due dates and repeating jobs."
            onChange={(e) => setTz(e.target.value)}
          />
          <datalist id="ovie-timezones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <div>
            <Button
              type="submit"
              variant="secondary"
              busy={busy}
              disabled={!name.trim() || !tz.trim() || (name.trim() === household.name && tz.trim() === household.timezone)}
            >
              Save household
            </Button>
          </div>
        </form>
      ) : (
        <div className="stack stack--sm">
          <p>{household.name}</p>
          <p className="field__hint">Time zone: {household.timezone}. Only an owner can change these.</p>
        </div>
      )}
      <div className="field">
        <span className="field__label">Week starts on</span>
        <Segmented
          label="Week starts on"
          value={String(settings.week_starts_on) as '0' | '1'}
          options={WEEK_STARTS}
          onChange={setWeekStart}
          disabled={!canEditSettings}
        />
      </div>
    </Card>
  );
}

function MembersCard() {
  const client = useOvieClient();
  const toast = useToast();
  const { members, me, reload } = useHousehold();
  const [removing, setRemoving] = useState<HouseholdMember | null>(null);
  const roleLabel = { owner: 'Owner', member: 'Member', device: 'Screen' } as const;

  return (
    <Card title="People and screens" icon={<Users size={20} aria-hidden="true" />}>
      <ul className="rows">
        {members.map((m) => (
          <li key={m.user_id} className="row">
            <Avatar name={m.display_name} colour={m.colour} />
            <span className="row__main">
              {m.display_name}
              {m.user_id === me.user_id && <span className="row__sub"> (you)</span>}
            </span>
            <span className="badge">{roleLabel[m.role]}</span>
            {me.role === 'owner' && m.user_id !== me.user_id && (
              <Button variant="ghost" iconOnly aria-label={`Remove ${m.display_name}`} onClick={() => setRemoving(m)}>
                <Trash2 size={20} aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.display_name ?? ''}?`}
        body="They’ll lose access to this household straight away. Their account isn’t deleted, and you can invite them again."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          const { error } = await client
            .from('household_members')
            .delete()
            .eq('household_id', removing.household_id)
            .eq('user_id', removing.user_id);
          setRemoving(null);
          if (error) toast.show(friendlyError(error), { tone: 'error' });
          else {
            toast.show('Removed');
            await reload();
          }
        }}
      />
    </Card>
  );
}

function InvitesCard() {
  const client = useOvieClient();
  const toast = useToast();
  const { household } = useHousehold();
  const [invites, setInvites] = useState<HouseholdInvite[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'member' | 'device' | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await client
      .from('household_invites')
      .select('id, code, role, created_at, expires_at, used_at')
      .eq('household_id', household.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) setError(error);
    else {
      setError(null);
      setInvites(data as HouseholdInvite[]);
    }
  }, [client, household.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(role: 'member' | 'device') {
    setBusy(role);
    const { error } = await client.rpc('create_invite', { p_household_id: household.id, p_role: role });
    setBusy(null);
    if (error) toast.show(friendlyError(error), { tone: 'error' });
    else await load();
  }

  async function revoke(id: string) {
    const { error } = await client.from('household_invites').delete().eq('id', id);
    if (error) toast.show(friendlyError(error), { tone: 'error' });
    else await load();
  }

  const expires = (iso: string) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(iso));

  return (
    <Card title="Invite codes" icon={<Plus size={20} aria-hidden="true" />}>
      <p className="field__hint">
        Sign in on the new phone or screen, then enter the code. Codes work once and expire after 7 days.
      </p>
      <div className="cluster">
        <Button variant="secondary" icon={<UserRound size={18} aria-hidden="true" />} busy={busy === 'member'} onClick={() => void create('member')}>
          Invite a person
        </Button>
        <Button variant="secondary" icon={<MonitorSmartphone size={18} aria-hidden="true" />} busy={busy === 'device'} onClick={() => void create('device')}>
          Add a screen
        </Button>
      </div>
      {error != null && <ErrorNotice error={error} onRetry={() => void load()} />}
      {invites === null && error == null && <Spinner />}
      {invites && invites.length > 0 && (
        <ul className="rows">
          {invites.map((inv) => (
            <li key={inv.id} className="row">
              <span className="row__main">
                <span className="code">{inv.code}</span>
                <span className="row__sub">
                  {' '}
                  {inv.role === 'device' ? 'Screen' : 'Person'} · expires {expires(inv.expires_at)}
                </span>
              </span>
              <Button variant="ghost" iconOnly aria-label={`Cancel code ${inv.code}`} onClick={() => void revoke(inv.id)}>
                <Trash2 size={20} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeviceCard() {
  const { signOut, session } = useAuth();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card title="This device" icon={<LogOut size={20} aria-hidden="true" />}>
      <p className="field__hint">
        Signed in as {session?.user.email}. Build {__OVIE_BUILD__}.
      </p>
      <div>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Sign out
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Sign out of this device?"
        body="You’ll need the email and password to sign back in."
        confirmLabel="Sign out"
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          await signOut();
        }}
      />
    </Card>
  );
}
