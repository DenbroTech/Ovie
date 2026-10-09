// Row types for the `ovie` schema. Hand-written for now; replace with
// `supabase gen types` output once the migration is applied.

export type Role = 'owner' | 'member' | 'device';
export type MemberColour = 'sage' | 'clay' | 'sky' | 'plum' | 'ochre' | 'slate';
export type ThemePref = 'system' | 'light' | 'dark';

export const MEMBER_COLOURS: readonly MemberColour[] = ['sage', 'clay', 'sky', 'plum', 'ochre', 'slate'];

export interface Household {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: Role;
  display_name: string;
  colour: MemberColour;
  joined_at: string;
}

export interface HouseholdSettings {
  household_id: string;
  week_starts_on: number;
  prefs: Record<string, unknown>;
}

export interface MemberSettings {
  household_id: string;
  user_id: string;
  theme: ThemePref;
  prefs: Record<string, unknown>;
}

export interface HouseholdInvite {
  id: string;
  code: string;
  role: Exclude<Role, 'owner'>;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}
