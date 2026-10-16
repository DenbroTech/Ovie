import { useEffect, useState } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { OvieSheep } from '../components/OvieSheep';
import { Home } from '../features/home/Home';
import { APPS, MORE_SCREENS } from './apps';
import { useConnection } from './ConnectionProvider';
import { useHousehold } from './HouseholdProvider';
import { AlarmRinger } from '../features/alarms/Alarms';
import { Screensaver, screensaverMinutes, useIdle } from '../features/screensaver/Screensaver';
import { fitWall } from '../lib/wallFit';
import { applyFrame } from '../lib/frame';
import { enableDragScroll } from '../lib/dragScroll';
import { ActivityProvider, useHighlightOnArrival } from '../features/activity/Activity';

/** Direction of the slide: into an app = from the right, back home = from the left. */
export function slideDirection(pathname: string, state: unknown): 'forward' | 'back' | 'none' {
  const dir = (state as { dir?: string } | null)?.dir;
  if (dir === 'forward' || dir === 'back') return dir;
  return pathname === '/' ? 'none' : 'forward';
}

/** Only for setting up / pairing a device, which needs the server. Inside Ovie there's no banner:
 *  it works offline, and Settings says quietly when it's offline. */
export function OfflineBanner() {
  const { connected } = useConnection();
  if (connected) return null;
  return (
    <div className="offline-banner" role="status">
      <OvieSheep size={34} mood="sad" title="" /><WifiOff size={18} /> No internet. Setting up needs a connection.
    </div>
  );
}

/** The Pi has no colour emoji font, so emoji show as empty squares. Load Google's Noto Color Emoji on the wall
 *  (only the bits of it that are used are downloaded; the service worker keeps them for offline). */
const EMOJI_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap';
function loadEmojiFont() {
  if (document.querySelector(`link[href="${EMOJI_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = EMOJI_CSS;
  document.head.appendChild(link);
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
    const undrag = enableDragScroll();
    loadEmojiFont();
    return () => { unfit(); unframe(); undrag(); delete root.dataset.device; };
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
  useHighlightOnArrival();

  return (
    <ActivityProvider>
    <div className="shell">
      <AlarmRinger />
      {idle && <Screensaver onWake={wake} />}
      <div key={location.pathname} className={`page slide-${dir}`}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          {[...APPS, ...MORE_SCREENS].map((app) => (
            <Route key={app.id} path={`${app.path}/*`} element={<app.Screen />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
    </ActivityProvider>
  );
}
