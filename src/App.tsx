import { useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { readConfig } from './lib/config';
import { createOvieClient, type OvieClient } from './lib/supabase';
import { OvieClientContext } from './lib/OvieContext';
import { ConnectionProvider } from './lib/connection';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { HouseholdProvider, useHouseholdState } from './household/HouseholdProvider';
import { AppShell } from './shell/AppShell';
import { ToastProvider } from './ui/Toast';
import { ErrorNotice, FullScreenSpinner } from './ui/States';
import { Button } from './ui/Button';
import { SetupNeeded } from './pages/SetupNeeded';
import { SignIn } from './pages/SignIn';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { More } from './pages/More';
import { ComingSoon } from './pages/ComingSoon';
import { ConnectionBanner } from './ui/ConnectionBanner';

export function App() {
  const client = useMemo(() => {
    const config = readConfig();
    return config ? createOvieClient(config) : null;
  }, []);
  if (!client) return <SetupNeeded />;
  return <AppWithClient client={client} />;
}

/** Split out so tests can inject a fake client. */
export function AppWithClient({ client }: { client: OvieClient }) {
  return (
    <OvieClientContext.Provider value={client}>
      <ConnectionProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AuthGate />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ConnectionProvider>
    </OvieClientContext.Provider>
  );
}

function AuthGate() {
  const { session } = useAuth();
  if (session === undefined) return <FullScreenSpinner label="Starting Ovie" />;
  if (!session) {
    return (
      <>
        <ConnectionBanner />
        <SignIn />
      </>
    );
  }
  return (
    <HouseholdProvider key={session.user.id} userId={session.user.id}>
      <HouseholdGate />
    </HouseholdProvider>
  );
}

function HouseholdGate() {
  const { state, reload } = useHouseholdState();
  const { signOut } = useAuth();
  if (state.status === 'loading') return <FullScreenSpinner label="Loading your household" />;
  if (state.status === 'error') {
    return (
      <div className="center-screen">
        <ConnectionBanner />
        <div className="stack auth-card">
          <ErrorNotice error={state.error} onRetry={() => void reload()} />
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }
  if (state.status === 'none') {
    return (
      <>
        <ConnectionBanner />
        <Onboarding />
      </>
    );
  }
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<ComingSoon title="Tasks" step="step 3" />} />
        <Route path="shopping" element={<ComingSoon title="Shopping" step="step 4" />} />
        <Route path="calendar" element={<ComingSoon title="Calendar" step="step 5" />} />
        <Route path="watch" element={<ComingSoon title="Watch" step="step 6" />} />
        <Route path="casa" element={<ComingSoon title="Casa" step="step 7" />} />
        <Route path="more" element={<More />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
