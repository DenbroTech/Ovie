import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/AuthProvider';
import { HouseholdProvider, useHousehold } from './app/HouseholdProvider';
import { ConnectionProvider } from './app/ConnectionProvider';
import { useTheme, storedTheme } from './app/theme';
import { Shell, OfflineBanner } from './app/Shell';
import { SignIn } from './features/auth/SignIn';
import { Onboarding } from './features/onboarding/Onboarding';
import { Loading } from './components/Loading';
import { ToastProvider } from './components/Toast';
import { OvieSheep } from './components/OvieSheep';
import { configError } from './lib/supabase';

function Gate() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <><OfflineBanner /><SignIn /></>;
  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  );
}

function HouseholdGate() {
  const { status, error, me, refresh } = useHousehold();
  useTheme(me?.prefs.theme ?? storedTheme());

  if (status === 'loading') return <Loading label="Opening your household…" />;
  if (status === 'error') {
    return (
      <div className="center-page">
        <OfflineBanner />
        <OvieSheep size={96} mood="sleepy" />
        <div className="notice notice-error" role="alert" style={{ maxWidth: 520 }}>{error}</div>
        <button className="btn btn-primary" onClick={() => void refresh()}>Try again</button>
      </div>
    );
  }
  if (status === 'none') return <><OfflineBanner /><Onboarding /></>;
  return <Shell />;
}

export default function App() {
  useTheme(storedTheme());
  if (configError) {
    return (
      <div className="center-page">
        <OvieSheep size={96} mood="sleepy" />
        <div className="notice notice-error" role="alert" style={{ maxWidth: 560 }}>{configError}</div>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <ConnectionProvider>
        <ToastProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ToastProvider>
      </ConnectionProvider>
    </BrowserRouter>
  );
}
