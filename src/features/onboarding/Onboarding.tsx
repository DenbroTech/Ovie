import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { browserTimeZone } from '../../lib/time';
import { OvieSheep } from '../../components/OvieSheep';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';

type Mode = 'create' | 'join';

export function Onboarding() {
  const { refresh } = useHousehold();
  const { online } = useConnection();
  const [mode, setMode] = useState<Mode>('create');
  const [householdName, setHouseholdName] = useState('Our home');
  const [yourName, setYourName] = useState('');
  const [code, setCode] = useState('');
  const [isKiosk, setIsKiosk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error } =
        mode === 'create'
          ? await supabase.rpc('create_household', {
              p_name: householdName.trim(),
              p_display_name: yourName.trim(),
              p_timezone: browserTimeZone(),
            })
          : await supabase.rpc('join_household', {
              p_code: code.trim(),
              p_display_name: isKiosk ? 'Kiosk' : yourName.trim(),
              p_role: isKiosk ? 'device' : 'adult',
            });
      if (error) throw error;
      await refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card card stack">
        <div className="auth-hero">
          <OvieSheep size={96} />
          <h1>Welcome!</h1>
          <p className="muted">Start a new household, or join one with its invite code.</p>
        </div>

        <div className="segmented" role="group" aria-label="Create or join">
          <button type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>New household</button>
          <button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Join with code</button>
        </div>

        <form className="stack" onSubmit={submit}>
          {mode === 'create' ? (
            <div className="field">
              <label htmlFor="hh">Household name</label>
              <input id="hh" required maxLength={80} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="code">Invite code</label>
                <input id="code" required placeholder="ABCD-EFGH" autoCapitalize="characters" autoComplete="off"
                  value={code} onChange={(e) => setCode(e.target.value)} />
                <span className="hint">Find it in Settings on a device that is already set up.</span>
              </div>
              <label className="check">
                <input type="checkbox" checked={isKiosk} onChange={(e) => setIsKiosk(e.target.checked)} />
                <span>This is the shared wall screen (kiosk)</span>
              </label>
            </>
          )}
          {!(mode === 'join' && isKiosk) && (
            <div className="field">
              <label htmlFor="you">Your name</label>
              <input id="you" required maxLength={40} autoComplete="given-name" value={yourName}
                onChange={(e) => setYourName(e.target.value)} />
            </div>
          )}
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !online}>
            {busy ? 'Please wait…' : mode === 'create' ? 'Create household' : 'Join household'}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
