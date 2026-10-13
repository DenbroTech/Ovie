import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';

// No logins: every device gets its own anonymous Supabase session automatically and keeps it.
// What it may see is decided by pairing (ovie.devices) + row-level security, not by a password.
interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function savedSession(): Session | null {
  try {
    const raw = JSON.parse(localStorage.getItem('ovie-auth') ?? 'null');
    const s = raw?.currentSession ?? raw;
    return s?.access_token && s?.user?.id ? (s as Session) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, error: null, retry: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensureSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: getErr } = await supabase.auth.getSession();
    if (data.session) {
      setSession(data.session);
      setLoading(false);
      return;
    }
    // Offline with an expired sign-in: keep using the saved one (reads come from this device's copy) and
    // try again when the connection is back. Never sign in afresh just because the network is down:
    // a new sign-in would be a new, unpaired device.
    const saved = savedSession();
    if (saved && (getErr || !navigator.onLine)) {
      setSession(saved);
      setLoading(false);
      const again = () => { window.removeEventListener('online', again); void ensureSession(); };
      window.addEventListener('online', again);
      return;
    }
    const res = await supabase.auth.signInAnonymously();
    if (res.error) setError(friendlyError(res.error));
    setSession(res.data.session);
    setLoading(false);
  }, []);

  useEffect(() => {
    void ensureSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [ensureSession]);

  return (
    <AuthContext.Provider value={{ session, loading, error, retry: () => void ensureSession() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
