import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/supabase', () => ({ supabase: {}, configError: null }));
let me = { id: 'm', display_name: 'Andrew', role: 'owner', colour: 'sage', prefs: {} };
vi.mock('../../app/HouseholdProvider', () => ({
  useHousehold: () => ({
    household: { id: 'h', name: 'Our home', timezone: 'Australia/Sydney', invite_code: 'X', settings: {} },
    me,
  }),
}));

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

  it('does not greet the wall screen by name', () => {
    me = { ...me, display_name: 'Kiosk', role: 'device' };
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.queryByText(/Kiosk!/)).not.toBeInTheDocument();
  });
});
