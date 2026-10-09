import { NavLink, Outlet } from 'react-router-dom';
import { NAV_ITEMS } from './nav';
import { ConnectionBanner } from '../ui/ConnectionBanner';

export function AppShell() {
  const settings = NAV_ITEMS.find((n) => n.to === '/settings')!;
  const main = NAV_ITEMS.filter((n) => n !== settings);
  return (
    <div className="shell">
      <ConnectionBanner />
      <nav className="nav" aria-label="Main">
        <div className="nav__brand">
          <img src="/icon.svg" width={44} height={44} alt="Ovie" />
        </div>
        {main.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
        <div className="nav__spacer" />
        <NavItemLink item={settings} />
      </nav>
      <main className="shell__main">
        <div className="shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItemLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const Icon = item.icon;
  const cls = ['nav__link', item.placement === 'rail' && 'nav__link--secondary', item.placement === 'phone' && 'nav__link--phone']
    .filter(Boolean)
    .join(' ');
  return (
    <NavLink to={item.to} end={item.to === '/'} className={cls}>
      <span className="nav__icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      {item.label}
    </NavLink>
  );
}
