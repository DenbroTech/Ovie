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

const AuthContext = createContext<AuthState>({ session: null, loading: true, error: null, retry: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensureSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setSession(data.session);
      setLoading(false);
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
