import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from '../shell/nav';
import { PageHeader } from '../shell/PageHeader';
import { Card } from '../ui/Card';

/** Phone-only page listing the sections that don't fit in the tab bar. */
export function More() {
  const items = NAV_ITEMS.filter((n) => n.placement === 'rail');
  return (
    <>
      <PageHeader title="More" />
      <Card as="div">
        <ul className="rows">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                <Icon size={22} aria-hidden="true" />
                <span className="row__main">{label}</span>
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
