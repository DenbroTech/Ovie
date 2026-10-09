import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// "online" = the browser has a network AND (if we have a live channel) Realtime is connected.
type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | string;

interface ConnectionState {
  online: boolean;
  reportRealtime: (status: RealtimeStatus) => void;
}

const ConnectionContext = createContext<ConnectionState>({ online: true, reportRealtime: () => {} });

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [realtimeOk, setRealtimeOk] = useState(true);

  useEffect(() => {
    const up = () => setNetwork(true);
    const down = () => setNetwork(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const reportRealtime = useCallback((status: RealtimeStatus) => {
    if (status === 'SUBSCRIBED') setRealtimeOk(true);
    else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') setRealtimeOk(false);
  }, []);

  const value = useMemo(() => ({ online: network && realtimeOk, reportRealtime }), [network, realtimeOk, reportRealtime]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export const useConnection = () => useContext(ConnectionContext);
