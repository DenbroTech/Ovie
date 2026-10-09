import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configError: string | null =
  !url || !key
    ? 'Ovie is missing its Supabase settings (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY). See README → "Run it on your PC".'
    : null;

// Everything Ovie reads or writes lives in the `ovie` schema.
export const supabase: SupabaseClient<any, 'ovie'> = createClient(
  url ?? 'http://invalid.localhost',
  key ?? 'missing',
  {
    db: { schema: 'ovie' },
    auth: {
      persistSession: true, // the kiosk stays signed in across reboots
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ovie-auth',
    },
  },
);
