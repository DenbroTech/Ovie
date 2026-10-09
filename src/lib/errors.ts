/** Turns Supabase/PostgREST/network errors into short, honest messages for people. */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = e?.message ?? (typeof err === 'string' ? err : '');
  if (!msg && !e?.code) return 'Something went wrong.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "Can't reach Ovie's server. Check the internet connection and try again.";
  }
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(msg)) return 'This account’s email hasn’t been confirmed yet.';
  if (e?.code === 'PGRST106' || /schema must be one of|invalid schema/i.test(msg)) {
    return 'The ovie schema isn’t exposed to the Data API yet (Supabase → Settings → Data API → Exposed schemas).';
  }
  if (e?.code === '42501') return 'You don’t have permission to do that.';
  return msg || 'Something went wrong.';
}
