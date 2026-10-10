import type { Member } from '../lib/types';
import { Avatar } from './Avatar';
import { Users } from 'lucide-react';

/** Big tappable chips: "Everyone" (null) or one person. */
export function PersonPicker({
  members, value, onChange, everyoneLabel = 'Everyone', label,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  everyoneLabel?: string;
  label: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value === null} className="chip-btn" onClick={() => onChange(null)}>
        <span className="avatar chip-avatar everyone"><Users size={16} /></span>{everyoneLabel}
      </button>
      {members.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={value === m.id} className="chip-btn" onClick={() => onChange(m.id)}>
          <Avatar member={m} size={26} />{m.display_name}
        </button>
      ))}
    </div>
  );
}

/** Small avatar for "who"; shared items show a two-tone dot. */
export function WhoBadge({ member, title }: { member: Member | null | undefined; title?: string }) {
  if (!member) return <span className="avatar who-everyone" title={title ?? 'Everyone'} aria-label={title ?? 'Everyone'}><Users size={14} /></span>;
  return <span title={member.display_name} aria-label={member.display_name}><Avatar member={member} size={30} /></span>;
}
