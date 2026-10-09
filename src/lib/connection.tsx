import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useOvieClient } from './OvieContext';

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

const ConnectionContext = createContext<ConnectionStatus>('online');

export function useConnection(): ConnectionStatus {
  return useContext(ConnectionContext);
}

/**
 * Tracks whether this device can talk to Supabase:
 *   offline      – the browser reports no network
 *   reconnecting – network is up but the Realtime socket isn't
 *   online       – Realtime is connected (so live sync is working)
 */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const client = useOvieClient();
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [realtimeUp, setRealtimeUp] = useState(true); // optimistic until told otherwise

  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    // A lightweight channel whose only job is to report socket health.
    const channel = client.channel('ovie-heartbeat').subscribe((status) => {
      setRealtimeUp(status === 'SUBSCRIBED');
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client]);

  const status: ConnectionStatus = !browserOnline ? 'offline' : realtimeUp ? 'online' : 'reconnecting';
  return <ConnectionContext.Provider value={status}>{children}</ConnectionContext.Provider>;
}
