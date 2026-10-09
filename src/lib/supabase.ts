import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OvieConfig } from './config';

export type OvieClient = SupabaseClient<any, 'ovie', 'ovie', any, any>;

/**
 * All Ovie queries go to the `ovie` schema. The frontend never queries
 * `public` (₲ryd's tables); the Casa panel reads them through ovie RPCs.
 */
export function createOvieClient(config: OvieConfig): OvieClient {
  return createClient(config.supabaseUrl, config.supabaseKey, {
    db: { schema: 'ovie' },
    auth: {
      persistSession: true,     // the kiosk stays signed in across reboots
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'ovie.auth',  // separate from any other app on the same origin
    },
  }) as OvieClient;
}
