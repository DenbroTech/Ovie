import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useConnection } from '../lib/connection';

/** Shows after a short grace period so brief blips don't flash a banner. */
export function ConnectionBanner({ graceMs = 2500 }: { graceMs?: number }) {
  const status = useConnection();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'online') {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), graceMs);
    return () => clearTimeout(t);
  }, [status, graceMs]);

  if (!visible || status === 'online') return null;
  return (
    <div className="conn-banner" role="status" aria-live="polite">
      {status === 'offline' ? <WifiOff size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
      {status === 'offline' ? 'Offline — changes can’t be saved until the internet is back' : 'Reconnecting to Ovie…'}
    </div>
  );
}
