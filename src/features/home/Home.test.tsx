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

  it('greets the shared wall screen without a name', () => {
    me = null;
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByText(/^Good (morning|afternoon|evening|night)!$/)).toBeInTheDocument();
  });
});
