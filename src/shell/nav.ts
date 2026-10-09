import { CalendarDays, CheckSquare, Home, LayoutGrid, Settings, ShoppingCart, Tv, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 'both' shows in the phone tab bar and the rail; 'rail' only on wide screens; 'phone' only in the tab bar */
  placement: 'both' | 'rail' | 'phone';
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Today', icon: Home, placement: 'both' },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, placement: 'both' },
  { to: '/shopping', label: 'Shopping', icon: ShoppingCart, placement: 'both' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, placement: 'both' },
  { to: '/watch', label: 'Watch', icon: Tv, placement: 'rail' },
  { to: '/casa', label: 'Casa', icon: Wallet, placement: 'rail' },
  { to: '/more', label: 'More', icon: LayoutGrid, placement: 'phone' },
  { to: '/settings', label: 'Settings', icon: Settings, placement: 'rail' },
];
