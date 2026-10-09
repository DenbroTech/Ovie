export interface OvieConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

/** Reads build-time config. Returns null (and the app shows a setup screen) if it's missing. */
export function readConfig(env: Partial<ImportMetaEnv> = import.meta.env): OvieConfig | null {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl)) return null;
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), supabaseKey };
}
