import { Users, Sparkles } from 'lucide-react';
import { useHousehold } from '../household/HouseholdProvider';
import { formatClock, formatLongDate, greeting, hourIn, useNow } from '../lib/time';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';

const ROLE_LABEL = { owner: 'Owner', member: 'Member', device: 'Screen' } as const;

export function Dashboard() {
  const { household, me, members } = useHousehold();
  const now = useNow();
  const tz = household.timezone;
  const hello = me.role === 'device' ? greeting(hourIn(now, tz)) : `${greeting(hourIn(now, tz))}, ${me.display_name}`;

  return (
    <>
      <header>
        <p className="page-header__sub">{hello}</p>
        <div>
          <div className="clock" aria-label={`The time is ${formatClock(now, tz)}`}>
            {formatClock(now, tz)}
          </div>
          <p className="clock-date">{formatLongDate(now, tz)}</p>
        </div>
      </header>

      <div className="grid">
        <Card title="Household" icon={<Users size={20} aria-hidden="true" />}>
          <ul className="rows">
            {members.map((m) => (
              <li key={m.user_id} className="row">
                <Avatar name={m.display_name} colour={m.colour} />
                <span className="row__main">{m.display_name}</span>
                <span className="badge">{ROLE_LABEL[m.role]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What’s coming" icon={<Sparkles size={20} aria-hidden="true" />}>
          <p>
            {household.name} is set up. Today’s events, tasks, the shopping list and what you’re watching will
            appear here as each section is built.
          </p>
        </Card>
      </div>
    </>
  );
}
