import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { OvieSheep } from '../../components/OvieSheep';
import { useConnection } from '../../app/ConnectionProvider';

type Mode = 'signin' | 'signup';

export function SignIn() {
  const { online } = useConnection();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Account created. Check your email for a confirmation link, then come back and sign in.');
          setMode('signin');
        }
      }
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
          <OvieSheep size={112} />
          <h1>Ovie</h1>
          <p className="muted">Our home, in one place.</p>
        </div>

        <div className="segmented" role="group" aria-label="Sign in or create account">
          <button type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>Sign in</button>
          <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>Create account</button>
        </div>

        <form className="stack" onSubmit={submit} aria-label="Account">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === 'signup' && <span className="hint">At least 8 characters.</span>}
          </div>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {info && <div className="notice notice-info">{info}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !online}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
