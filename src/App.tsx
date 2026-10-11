import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/AuthProvider';
import { HouseholdProvider, useHousehold } from './app/HouseholdProvider';
import { ConnectionProvider } from './app/ConnectionProvider';
import { useTheme, storedTheme, ThemeContext } from './app/theme';
import { Shell, OfflineBanner } from './app/Shell';
import { SetupHousehold, PairDevice } from './features/onboarding/Onboarding';
import { Loading } from './components/Loading';
import { ToastProvider } from './components/Toast';
import { OvieSheep } from './components/OvieSheep';
import { configError } from './lib/supabase';
import type { ThemePref } from './lib/types';

function ErrorPage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="center-page">
      <OfflineBanner />
      <OvieSheep size={96} mood="sad" />
      <div className="notice notice-error" role="alert" style={{ maxWidth: 560 }}>{message}</div>
      <button className="btn btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}

function Gate() {
  const { session, loading, error, retry } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <ErrorPage message={error ?? 'Ovie could not start.'} onRetry={retry} />;
  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  );
}

function HouseholdGate() {
  const { status, error, refresh } = useHousehold();
  if (status === 'loading') return <Loading label="Opening your home…" />;
  if (status === 'error') return <ErrorPage message={error ?? 'Something went wrong.'} onRetry={() => void refresh()} />;
  if (status === 'setup') return <><OfflineBanner /><SetupHousehold /></>;
  if (status === 'join') return <><OfflineBanner /><PairDevice /></>;
  return <Shell />;
}

export default function App() {
  const [theme, setTheme] = useState<ThemePref>(storedTheme);
  useTheme(theme);
  if (configError) {
    return (
      <div className="center-page">
        <OvieSheep size={96} mood="sad" />
        <div className="notice notice-error" role="alert" style={{ maxWidth: 560 }}>{configError}</div>
      </div>
    );
  }
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <ConnectionProvider>
          <ToastProvider>
            <AuthProvider>
              <Gate />
            </AuthProvider>
          </ToastProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}
