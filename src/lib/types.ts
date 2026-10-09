export type Role = 'owner' | 'adult' | 'device';
export type MemberColour = 'sage' | 'clay' | 'sky' | 'plum' | 'sand' | 'slate';
export type ThemePref = 'system' | 'light' | 'dark';

export const MEMBER_COLOURS: MemberColour[] = ['sage', 'clay', 'sky', 'plum', 'sand', 'slate'];

export interface Household {
  id: string;
  name: string;
  timezone: string;
  invite_code: string;
  settings: Record<string, unknown>;
}

export interface Member {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  role: Role;
  colour: MemberColour;
  prefs: { theme?: ThemePref } & Record<string, unknown>;
}
