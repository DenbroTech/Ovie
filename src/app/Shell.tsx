import { useEffect, useState } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { OvieSheep } from '../components/OvieSheep';
import { Home } from '../features/home/Home';
import { APPS } from './apps';
import { useConnection } from './ConnectionProvider';
import { useHousehold } from './HouseholdProvider';
import { AlarmRinger } from '../features/alarms/Alarms';
import { Screensaver, screensaverMinutes, useIdle } from '../features/screensaver/Screensaver';
import { fitWall } from '../lib/wallFit';
import { applyFrame } from '../lib/frame';

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
      <OvieSheep size={34} mood="sad" title="" /><WifiOff size={18} /> Offline — reconnecting… Changes are paused until Ovie is back online.
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const { thisDevice } = useHousehold();

  // The wall screen (7" 1024x600 in the frame) gets bigger text, bigger targets and no mouse pointer.
  useEffect(() => {
    const root = document.documentElement;
    if (thisDevice?.kind !== 'wall') { delete root.dataset.device; return; }
    root.dataset.device = 'wall';
    const unfit = fitWall(root);
    const unframe = applyFrame(root);
    return () => { unfit(); unframe(); delete root.dataset.device; };
  }, [thisDevice?.kind]);

  const isWall = thisDevice?.kind === 'wall';
  const [minutes, setMinutes] = useState(() => screensaverMinutes(isWall));
  useEffect(() => {
    const update = () => setMinutes(screensaverMinutes(isWall));
    update();
    window.addEventListener('ovie-screensaver-changed', update);
    return () => window.removeEventListener('ovie-screensaver-changed', update);
  }, [isWall]);
  const [idle, wake] = useIdle(minutes);

  const dir = slideDirection(location.pathname, location.state);

  return (
    <div className="shell">
      <OfflineBanner />
      <AlarmRinger />
      {idle && <Screensaver onWake={wake} />}
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
