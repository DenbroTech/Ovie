import type { CSSProperties } from 'react';
import type { MemberColour } from '../lib/db-types';

export function memberColourStyle(colour: MemberColour): CSSProperties {
  return { ['--m-fg' as string]: `var(--m-${colour})`, ['--m-bg' as string]: `var(--m-${colour}-soft)` };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, colour, size = 'md' }: { name: string; colour: MemberColour; size?: 'md' | 'lg' }) {
  return (
    <span className={`avatar${size === 'lg' ? ' avatar--lg' : ''}`} style={memberColourStyle(colour)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
