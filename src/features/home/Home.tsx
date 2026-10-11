import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OvieSheep, reactSheep } from '../../components/OvieSheep';
import { isNight, storedNight } from '../../app/theme';
import { dayMood } from '../../lib/moods';
import { useHousehold } from '../../app/HouseholdProvider';
import { APPS } from '../../app/apps';
import { formatClock, formatLongDate, greetingFor } from '../../lib/time';
import { useBadges, type TodayEvent } from './useBadges';

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Home() {
  const { household, me } = useHousehold();
  const now = useNow();
  const tz = household?.timezone;
  const name = me ? `, ${me.display_name}` : '';
  const { counts: badges, todayEvents } = useBadges(household?.id, tz);

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-time">
          <div className="clock" aria-label="Current time">{formatClock(now, tz)}</div>
          <div className="date">{formatLongDate(now, tz)}</div>
        </div>
        <TodayPanel events={todayEvents} tasks={badges.tasks} shopping={badges.shopping} timeZone={tz} />
        <div className="home-hello">
          <button type="button" className="sheep-btn" aria-label="Say hi to Ovie" onClick={() => reactSheep('silly', 2500)}>
            <OvieSheep size={84} reacts mood={dayMood({ night: isNight(now, { ...storedNight(), timeZone: tz }), todayTitles: todayEvents.map((e) => e.title) })} />
          </button>
          <div>
            <p className="hello-line">{greetingFor(now, tz)}{name}!</p>
            <p className="muted small">{household?.name}</p>
          </div>
        </div>
      </header>


      <nav className="app-grid" aria-label="Apps">
        {APPS.map((app) => (
          <Link key={app.id} to={app.path} state={{ dir: 'forward' }} className="app-tile">
            <span className="app-icon" style={{ background: app.colour }}>
              {app.icon}
              {badges[app.id] > 0 && <span className="app-badge" aria-label={`${badges[app.id]} waiting`}>{badges[app.id]}</span>}
            </span>
            <span className="app-name">{app.name}</span>
          </Link>
        ))}
      </nav>

    </div>
  );
}

function TodayPanel({ events, tasks, shopping, timeZone }: { events: TodayEvent[]; tasks: number; shopping: number; timeZone?: string }) {
  const lines: Array<{ key: string; to: string; colour: string; text: string; when?: string }> = [];
  for (const e of events.slice(0, 2)) {
    lines.push({
      key: e.start + e.title, to: '/calendar', colour: 'var(--app-calendar)', text: e.title,
      when: e.allDay ? 'today' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(e.start)),
    });
  }
  if (events.length > 2) lines.push({ key: 'more', to: '/calendar', colour: 'var(--app-calendar)', text: `+${events.length - 2} more today` });
  if (tasks > 0) lines.push({ key: 'tasks', to: '/tasks', colour: 'var(--app-tasks)', text: `${tasks} job${tasks === 1 ? '' : 's'} to do today` });
  if (shopping > 0) lines.push({ key: 'shop', to: '/shopping', colour: 'var(--app-shopping)', text: `${shopping} thing${shopping === 1 ? '' : 's'} to buy` });
  return (
    <section className="today" aria-label="Today">
      {lines.length === 0 ? <p className="today-line today-clear">Nothing on today. Enjoy!</p> : lines.map((l) => (
        <Link key={l.key} to={l.to} state={{ dir: 'forward' }} className="today-line">
          <span className="today-dot" style={{ background: l.colour }} />
          <span className="today-text">{l.text}</span>
          {l.when && <span className="today-when">{l.when}</span>}
        </Link>
      ))}
    </section>
  );
}
