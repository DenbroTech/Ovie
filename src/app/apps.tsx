import type { ComponentType, ReactNode } from 'react';
import { AlarmClock, CalendarDays, Image, MessageSquare, Settings as SettingsIcon, ShoppingCart, SquareCheckBig, Tv, Wallet } from 'lucide-react';
import { SettingsScreen } from '../features/settings/Settings';
import { TasksScreen } from '../features/tasks/Tasks';
import { ShoppingScreen } from '../features/shopping/Shopping';
import { CalendarScreen } from '../features/calendar/Calendar';
import { WatchScreen } from '../features/watch/Watch';
import { FinancesScreen } from '../features/finances/Finances';
import { NotesScreen } from '../features/notes/Notes';
import { PhotosScreen } from '../features/photos/Photos';
import { AlarmsScreen } from '../features/alarms/Alarms';

export interface OvieApp {
  id: string;
  name: string;
  path: string;
  colour: string; // CSS variable for the tile
  icon: ReactNode;
  Screen: ComponentType;
}

// Only apps that are actually built appear here (and therefore on the Home grid).
export const APPS: OvieApp[] = [
  { id: 'tasks', name: 'Tasks', path: '/tasks', colour: 'var(--app-tasks)', icon: <SquareCheckBig size={40} strokeWidth={2} />, Screen: TasksScreen },
  { id: 'shopping', name: 'Shopping', path: '/shopping', colour: 'var(--app-shopping)', icon: <ShoppingCart size={40} strokeWidth={2} />, Screen: ShoppingScreen },
  { id: 'calendar', name: 'Calendar', path: '/calendar', colour: 'var(--app-calendar)', icon: <CalendarDays size={40} strokeWidth={2} />, Screen: CalendarScreen },
  { id: 'notes', name: 'Notes', path: '/notes', colour: 'var(--app-notes)', icon: <MessageSquare size={40} strokeWidth={2} />, Screen: NotesScreen },
  { id: 'watch', name: 'Watch', path: '/watch', colour: 'var(--app-watch)', icon: <Tv size={40} strokeWidth={2} />, Screen: WatchScreen },
  { id: 'photos', name: 'Photos', path: '/photos', colour: 'var(--app-photos)', icon: <Image size={40} strokeWidth={2} />, Screen: PhotosScreen },
  { id: 'alarms', name: 'Alarms', path: '/alarms', colour: 'var(--app-alarms)', icon: <AlarmClock size={40} strokeWidth={2} />, Screen: AlarmsScreen },
  { id: 'finances', name: 'Finances', path: '/finances', colour: 'var(--app-casa)', icon: <Wallet size={40} strokeWidth={2} />, Screen: FinancesScreen },
  { id: 'settings', name: 'Settings', path: '/settings', colour: 'var(--app-settings)', icon: <SettingsIcon size={40} strokeWidth={2} />, Screen: SettingsScreen },
];
