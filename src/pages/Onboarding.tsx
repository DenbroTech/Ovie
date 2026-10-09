import { useState, type FormEvent } from 'react';
import { Home, KeyRound } from 'lucide-react';
import { useOvieClient } from '../lib/OvieContext';
import { useAuth } from '../auth/AuthProvider';
import { useHouseholdState } from '../household/HouseholdProvider';
import { browserTimeZone } from '../lib/time';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TextField } from '../ui/Field';
import { ErrorNotice } from '../ui/States';

/** Shown to a signed-in account that isn't in a household yet. */
export function Onboarding() {
  const client = useOvieClient();
  const { signOut, session } = useAuth();
  const { reload } = useHouseholdState();

  const [householdName, setHouseholdName] = useState('');
  const [yourName, setYourName] = useState('');
  const [code, setCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy('create');
    setError(null);
    const { error } = await client.rpc('create_household', {
      p_name: householdName,
      p_display_name: yourName,
      p_timezone: browserTimeZone(),
    });
    setBusy(null);
    if (error) setError(error);
    else await reload();
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy('join');
    setError(null);
    const { error } = await client.rpc('accept_invite', { p_code: code, p_display_name: joinName });
    setBusy(null);
    if (error) setError(error);
    else await reload();
  }

  return (
    <div className="center-screen">
      <div className="stack" style={{ width: 'min(880px, 100%)' }}>
        <header>
          <h1>Welcome to Ovie</h1>
          <p className="page-header__sub">
            Signed in as {session?.user.email}. Start a household, or join one with an invite code.
          </p>
        </header>
        {error != null && <ErrorNotice error={error} />}
        <div className="settings-grid">
          <Card title="Start a household" icon={<Home size={20} aria-hidden="true" />}>
            <form className="stack" onSubmit={create}>
              <TextField label="Household name" placeholder="e.g. Home" maxLength={80} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
              <TextField label="Your name" maxLength={40} value={yourName} onChange={(e) => setYourName(e.target.value)} />
              <Button type="submit" size="lg" busy={busy === 'create'} disabled={!householdName.trim() || !yourName.trim() || busy !== null}>
                Create household
              </Button>
            </form>
          </Card>
          <Card title="Join with a code" icon={<KeyRound size={20} aria-hidden="true" />}>
            <form className="stack" onSubmit={join}>
              <TextField
                label="Invite code"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                hint="8 letters/numbers, from Settings on the owner’s account"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <TextField label="Your name (or the screen’s name)" maxLength={40} value={joinName} onChange={(e) => setJoinName(e.target.value)} />
              <Button type="submit" size="lg" busy={busy === 'join'} disabled={code.trim().length !== 8 || !joinName.trim() || busy !== null}>
                Join household
              </Button>
            </form>
          </Card>
        </div>
        <div>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
