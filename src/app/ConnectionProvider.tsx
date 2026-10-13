import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STATUS_EVENT, SYNC_EVENT, isConnected, outbox } from '../lib/offline';

// Ovie works offline: screens show the last info saved on this device and changes wait to be sent
// (lib/offline.ts). So `online` stays true for buttons; `connected` and `waiting` are for the quiet
// status line in Settings (no banners).
type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | string;

interface ConnectionState {
  /** Can the user do things? Always yes: changes made offline are kept and sent later. */
  online: boolean;
  /** Is this device reaching Ovie's server right now? */
  connected: boolean;
  /** Changes made on this device that haven't been sent yet. */
  waiting: number;
  reportRealtime: (status: RealtimeStatus) => void;
}

const ConnectionContext = createContext<ConnectionState>({ online: true, connected: true, waiting: 0, reportRealtime: () => {} });

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [server, setServer] = useState(isConnected);
  const [waiting, setWaiting] = useState(() => outbox().length);

  useEffect(() => {
    const up = () => setNetwork(true);
    const down = () => setNetwork(false);
    const status = () => { setServer(isConnected()); setWaiting(outbox().length); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener(STATUS_EVENT, status);
    window.addEventListener(SYNC_EVENT, status);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.removeEventListener(STATUS_EVENT, status);
      window.removeEventListener(SYNC_EVENT, status);
    };
  }, []);

  const reportRealtime = useCallback((_status: RealtimeStatus) => {}, []);
  const value = useMemo(() => ({ online: true, connected: network && server, waiting, reportRealtime }), [network, server, waiting, reportRealtime]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export const useConnection = () => useContext(ConnectionContext);
