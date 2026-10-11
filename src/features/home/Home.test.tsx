import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => ({ supabase: {}, configError: null }));
let me: unknown = { id: 'm', household_id: 'h', display_name: 'Andrew', colour: 'sage' };
vi.mock('../../app/HouseholdProvider', () => ({
  useHousehold: () => ({
    household: { id: 'h', name: 'Our home', timezone: 'Australia/Sydney', invite_code: 'X', settings: {} },
    me,
  }),
}));

vi.mock('./useBadges', () => ({ useBadges: () => ({ counts: { tasks: 2, shopping: 5, calendar: 0, notes: 0 }, todayEvents: [] }) }));

import { Home } from './Home';

describe('Home', () => {
  it('shows the clock, greeting, Ovie and app tiles', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByLabelText('Current time')).toBeInTheDocument();
    expect(screen.getByText(/Andrew!/)).toBeInTheDocument();
    expect(screen.getByText('Our home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('img', { name: /ovie the sheep/i })).toBeInTheDocument();
  });

  it('shows all apps with live counts, and no badge when nothing is waiting', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    for (const name of ['Tasks', 'Shopping', 'Calendar', 'Notes', 'Watch', 'Menu', 'Alarms', 'Finances', 'Settings']) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('2 waiting')).toBeInTheDocument();
    expect(screen.getByLabelText('5 waiting')).toBeInTheDocument();
    expect(screen.queryByLabelText('0 waiting')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2 jobs to do today/ })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: /5 things to buy/ })).toHaveAttribute('href', '/shopping');
  });

  it('greets the shared wall screen without a name', () => {
    me = null;
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByText(/^Good (morning|afternoon|evening|night)!$/)).toBeInTheDocument();
  });
});
