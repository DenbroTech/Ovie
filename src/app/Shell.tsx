import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Home } from '../features/home/Home';
import { APPS } from './apps';
import { useConnection } from './ConnectionProvider';

/** Direction of the slide: into an app = from the right, back home = from the left. */
export function slideDirection(pathname: string, state: unknown): 'forward' | 'back' | 'none' {
  const dir = (state as { dir?: string } | null)?.dir;
  if (dir === 'forward' || dir === 'back') return dir;
  return pathname === '/' ? 'none' : 'forward';
}

export function OfflineBanner() {
  const { online } = useConnection();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={18} /> Offline — reconnecting… Changes are paused until Ovie is back online.
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const dir = slideDirection(location.pathname, location.state);

  return (
    <div className="shell">
      <OfflineBanner />
      <div key={location.pathname} className={`page slide-${dir}`}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          {APPS.map((app) => (
            <Route key={app.id} path={`${app.path}/*`} element={<app.Screen />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
