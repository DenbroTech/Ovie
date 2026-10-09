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
  if (lower.includes('anonymous sign-ins are disabled') || lower.includes('anonymous_provider_disabled')) {
    return 'Ovie cannot start yet: "Allow anonymous sign-ins" is switched off in Supabase (Authentication → Sign In / Providers).';
  }
  if (lower.includes('invite code not recognised')) return 'That code is not right. Check it on a device that is already set up (Settings).';
  if (lower.includes('already paired')) return 'This device is already set up.';
  if (lower.includes('already set up')) return 'Ovie is already set up. Use the household code to add this device.';
  if (e.code === '42501' || lower.includes('permission denied') || lower.includes('row-level security')) {
    return "You don't have permission to do that.";
  }
  return msg || 'Something went wrong.';
}
