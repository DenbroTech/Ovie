import { useState, type FormEvent } from 'react';
import { Monitor, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { browserTimeZone, initials } from '../../lib/time';
import { OvieSheep } from '../../components/OvieSheep';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import type { MemberColour } from '../../lib/types';

/** Very first device ever: create the household. */
export function SetupHousehold() {
  const { refresh } = useHousehold();
  const { online } = useConnection();
  const [householdName, setHouseholdName] = useState('Our home');
  const [yourName, setYourName] = useState('');
  const [isWall, setIsWall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('setup_household', {
      p_name: householdName.trim(),
      p_person_name: yourName.trim(),
      p_timezone: browserTimeZone(),
      p_kind: isWall ? 'wall' : 'personal',
    });
    if (error) setError(friendlyError(error));
    else await refresh();
    setBusy(false);
  }

  return (
    <div className="center-page">
      <div className="auth-card card stack">
        <div className="auth-hero">
          <OvieSheep size={112} />
          <h1>Hi, I'm Ovie!</h1>
          <p className="muted">Let's set up your home. This only happens once.</p>
        </div>
        <form className="stack" onSubmit={submit} aria-label="Set up Ovie">
          <div className="field">
            <label htmlFor="hh">Home name</label>
            <input id="hh" required maxLength={80} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="you">Your name</label>
            <input id="you" required maxLength={40} autoComplete="given-name" value={yourName}
              onChange={(e) => setYourName(e.target.value)} />
          </div>
          <label className="check">
            <input type="checkbox" checked={isWall} onChange={(e) => setIsWall(e.target.checked)} />
            <span>This is the shared wall screen</span>
          </label>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !online}>
            {busy ? 'Setting up…' : 'Start'}
          </button>
        </form>
      </div>
    </div>
  );
}

interface Person { id: string; display_name: string; colour: MemberColour }

/** Household exists: pair this device once with the code. */
export function PairDevice() {
  const { refresh } = useHousehold();
  const { online } = useConnection();
  const [code, setCode] = useState('');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('people_for_code', { p_code: code.trim() });
    if (error) setError(friendlyError(error));
    else if (!data || (data as Person[]).length === 0) setError('That code is not right. Check it on a device that is already set up (Settings).');
    else setPeople(data as Person[]);
    setBusy(false);
  }

  async function pair(args: { p_kind: 'personal' | 'wall'; p_member_id?: string; p_new_person_name?: string }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('pair_device', { p_code: code.trim(), ...args });
    if (error) setError(friendlyError(error));
    else await refresh();
    setBusy(false);
  }

  return (
    <div className="center-page">
      <div className="auth-card card stack">
        <div className="auth-hero">
          <OvieSheep size={104} />
          <h1>{people ? 'Who is this for?' : 'Add this device'}</h1>
          <p className="muted">
            {people ? 'Tap a name. You only do this once on each device.' : 'Type the home code. You can find it in Settings on any device that already uses Ovie.'}
          </p>
        </div>

        {!people ? (
          <form className="stack" onSubmit={checkCode} aria-label="Enter the home code">
            <div className="field">
              <label htmlFor="code">Home code</label>
              <input id="code" required placeholder="ABCD-EFGH" autoCapitalize="characters" autoComplete="off"
                className="code-input" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !online || !code.trim()}>
              {busy ? 'Checking…' : 'Next'}
            </button>
          </form>
        ) : newName === null ? (
          <div className="stack">
            <div className="person-grid">
              {people.map((p) => (
                <button key={p.id} type="button" className="person-tile" disabled={busy || !online}
                  onClick={() => void pair({ p_kind: 'personal', p_member_id: p.id })}>
                  <span className="avatar" style={{ width: 64, height: 64, fontSize: 26, background: `var(--member-${p.colour})` }}>
                    {initials(p.display_name)}
                  </span>
                  <span>{p.display_name}</span>
                </button>
              ))}
              <button type="button" className="person-tile" disabled={busy || !online} onClick={() => setNewName('')}>
                <span className="avatar person-tile-icon"><UserPlus size={28} /></span>
                <span>Someone new</span>
              </button>
              <button type="button" className="person-tile" disabled={busy || !online} onClick={() => void pair({ p_kind: 'wall' })}>
                <span className="avatar person-tile-icon"><Monitor size={28} /></span>
                <span>Wall screen</span>
              </button>
            </div>
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setPeople(null); setError(null); }}>Back</button>
          </div>
        ) : (
          <form className="stack" aria-label="New person"
            onSubmit={(e) => { e.preventDefault(); void pair({ p_kind: 'personal', p_new_person_name: newName.trim() }); }}>
            <div className="field">
              <label htmlFor="nn">Their name</label>
              <input id="nn" required maxLength={40} autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !online || !newName.trim()}>
              {busy ? 'Adding…' : 'Add and continue'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setNewName(null)}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
