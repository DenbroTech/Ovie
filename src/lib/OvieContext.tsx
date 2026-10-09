import { createContext, useContext } from 'react';
import type { OvieClient } from './supabase';

export const OvieClientContext = createContext<OvieClient | null>(null);

export function useOvieClient(): OvieClient {
  const client = useContext(OvieClientContext);
  if (!client) throw new Error('useOvieClient must be used inside <OvieClientContext.Provider>');
  return client;
}
