import type { Member } from '../lib/types';
import { initials } from '../lib/time';

export function Avatar({ member, size = 40 }: { member: Pick<Member, 'display_name' | 'colour'>; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background: `var(--member-${member.colour})`, fontSize: size * 0.42 }}
    >
      {initials(member.display_name)}
    </span>
  );
}
