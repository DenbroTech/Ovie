import type { ComponentType, ReactNode } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { SettingsScreen } from '../features/settings/Settings';

export interface OvieApp {
  id: string;
  name: string;
  path: string;
  colour: string; // CSS variable for the tile
  icon: ReactNode;
  Screen: ComponentType;
}

// Only apps that are actually built appear here (and therefore on the Home grid).
// Tasks, Shopping, Calendar, Watch and Casa are added as each one is finished.
export const APPS: OvieApp[] = [
  {
    id: 'settings',
    name: 'Settings',
    path: '/settings',
    colour: 'var(--app-settings)',
    icon: <SettingsIcon size={40} strokeWidth={2} />,
    Screen: SettingsScreen,
  },
];
