import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => ({ supabase: {}, configError: null }));
vi.mock('../../app/ConnectionProvider', () => ({ useConnection: () => ({ online: true, reportRealtime: () => {} }) }));
let kind: 'wall' | 'personal' = 'wall';
vi.mock('../../app/HouseholdProvider', () => ({
  useHousehold: () => ({
    household: { id: 'h', name: 'Our home', timezone: 'Australia/Sydney', invite_code: 'K7QF-3MZP', settings: {} },
    members: [{ id: 'm', household_id: 'h', display_name: 'Andrew', colour: 'sage' }],
    devices: [{ id: 'd', household_id: 'h', user_id: 'u', member_id: kind === 'wall' ? null : 'm', kind, label: 'Wall screen', last_seen_at: new Date().toISOString() }],
    thisDevice: { id: 'd', household_id: 'h', user_id: 'u', member_id: kind === 'wall' ? null : 'm', kind, label: 'Wall screen', last_seen_at: new Date().toISOString() },
    me: null,
    refresh: async () => {},
  }),
}));

import { SettingsScreen, DESKTOP_HELPER_URL } from './Settings';

describe('Settings: switch to the desktop', () => {
  it('shows on the wall screen and asks before leaving Ovie', async () => {
    kind = 'wall';
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /switch to the desktop/i }));
    expect(screen.getByRole('alertdialog', { name: /switch to the desktop/i })).toBeInTheDocument();
    expect(DESKTOP_HELPER_URL).toBe('http://127.0.0.1:8765/exit'); // the Pi's own helper, never the network
  });

  it('is not shown on phones', () => {
    kind = 'personal';
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /switch to the desktop/i })).not.toBeInTheDocument();
  });
});
