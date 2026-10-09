import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TextField } from '../ui/Field';
import { ErrorNotice } from '../ui/States';

export function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <Card as="div" className="auth-card">
        <div className="auth-brand">
          <img src="/icon.svg" width={48} height={48} alt="" />
          <h1>Ovie</h1>
        </div>
        <form className="stack" onSubmit={submit} noValidate>
          <TextField label="Email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error != null && <ErrorNotice error={error} />}
          <Button type="submit" size="lg" block busy={busy} disabled={!email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="field__hint">
            Accounts are created by the household owner. This screen stays signed in on this device until you sign out.
          </p>
        </form>
      </Card>
    </div>
  );
}
