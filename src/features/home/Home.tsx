import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OvieSheep } from '../../components/OvieSheep';
import { useHousehold } from '../../app/HouseholdProvider';
import { APPS } from '../../app/apps';
import { formatClock, formatLongDate, greetingFor } from '../../lib/time';

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

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-time">
          <div className="clock" aria-label="Current time">{formatClock(now, tz)}</div>
          <div className="date">{formatLongDate(now, tz)}</div>
        </div>
        <div className="home-hello">
          <OvieSheep size={84} />
          <div>
            <p className="hello-line">{greetingFor(now)}{name}!</p>
            <p className="muted small">{household?.name}</p>
          </div>
        </div>
      </header>

      <nav className="app-grid" aria-label="Apps">
        {APPS.map((app) => (
          <Link key={app.id} to={app.path} state={{ dir: 'forward' }} className="app-tile">
            <span className="app-icon" style={{ background: app.colour }}>{app.icon}</span>
            <span className="app-name">{app.name}</span>
          </Link>
        ))}
      </nav>

      <p className="home-footnote muted small">More apps (Tasks, Shopping, Calendar, Watch, Casa) arrive here as they are built.</p>
    </div>
  );
}
