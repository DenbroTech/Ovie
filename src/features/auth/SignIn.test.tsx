import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithPassword = vi.fn();
vi.mock('../../lib/supabase', () => ({
  configError: null,
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a), signUp: vi.fn() } },
}));

let online = true;
vi.mock('../../app/ConnectionProvider', () => ({ useConnection: () => ({ online, reportRealtime: () => {} }) }));

import { SignIn } from './SignIn';

describe('SignIn', () => {
  beforeEach(() => { signInWithPassword.mockReset(); online = true; });

  it('shows a friendly message for a wrong password', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<SignIn />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpassword');
    await userEvent.click(within(screen.getByRole('form', { name: 'Account' })).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.com', password: 'wrongpassword' });
  });

  it('disables sign in while offline', () => {
    online = false;
    render(<SignIn />);
    expect(within(screen.getByRole('form', { name: 'Account' })).getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
