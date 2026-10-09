// Turn Supabase/Postgres/network errors into plain-English messages.
interface ErrLike {
  message?: string;
  code?: string;
  status?: number;
}

export function friendlyError(err: unknown): string {
  if (!err) return 'Something went wrong.';
  const e = err as ErrLike;
  const msg = (e.message ?? String(err)).trim();
  const lower = msg.toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return "Can't reach Ovie's server. Check the internet connection and try again.";
  }
  if (e.code === 'PGRST106' || lower.includes('invalid schema') || lower.includes('schema must be one of')) {
    return 'The database is not ready yet: the "ovie" schema still needs to be exposed in Supabase (Settings → Data API → Exposed schemas).';
  }
  if (lower.includes('invalid login credentials')) return 'That email and password do not match.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the link.';
  if (lower.includes('user already registered')) return 'There is already an account with that email. Try signing in.';
  if (lower.includes('password should be at least')) return msg;
  if (lower.includes('invite code not recognised')) return 'That invite code is not right. Check it and try again.';
  if (lower.includes('already belongs to a household')) return 'This login is already part of a household.';
  if (e.code === '42501' || lower.includes('permission denied') || lower.includes('row-level security')) {
    return "You don't have permission to do that.";
  }
  return msg || 'Something went wrong.';
}
