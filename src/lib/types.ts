export type MemberColour = 'sage' | 'clay' | 'sky' | 'plum' | 'sand' | 'slate';
export type ThemePref = 'system' | 'light' | 'dark';
export type DeviceKind = 'personal' | 'wall';

export const MEMBER_COLOURS: MemberColour[] = ['sage', 'clay', 'sky', 'plum', 'sand', 'slate'];

export interface Household {
  id: string;
  name: string;
  timezone: string;
  invite_code: string;
  settings: Record<string, unknown>;
}

/** A person in the household. */
export interface Member {
  id: string;
  household_id: string;
  display_name: string;
  colour: MemberColour;
}

/** A paired phone, PC or the wall screen. member_id null = shared. */
export interface Device {
  id: string;
  household_id: string;
  user_id: string;
  member_id: string | null;
  kind: DeviceKind;
  label: string;
  last_seen_at: string;
}
