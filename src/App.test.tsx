import { describe, expect, it } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppWithClient } from './App';
import { fakeClient, householdHandler, HOUSEHOLD_ID } from './test/fakeClient';

const SESSION = { user: { id: 'u1', email: 'a@example.test' } };

describe('App', () => {
  it('shows sign-in when signed out and reports bad credentials', async () => {
    const { client } = fakeClient({ session: null });
    render(<AppWithClient client={client} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'a@example.test');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match');
  });

  it('signs in and moves to onboarding when the account has no household', async () => {
    const { client } = fakeClient({ session: null, query: householdHandler([]) });
    render(<AppWithClient client={client} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'a@example.test');
    await user.type(screen.getByLabelText('Password'), 'right');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to Ovie' })).toBeInTheDocument();
  });

  it('creates a household through the RPC, then shows the dashboard', async () => {
    let members: ReturnType<typeof householdHandler> = householdHandler([]);
    const { client, calls } = fakeClient({
      session: SESSION,
      query: (q) => members(q),
      rpc: () => {
        members = householdHandler();
        return { data: HOUSEHOLD_ID, error: null };
      },
    });
    render(<AppWithClient client={client} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Household name'), 'Home');
    const create = screen.getByRole('button', { name: 'Create household' });
    expect(create).toBeDisabled();
    await user.type(screen.getAllByLabelText('Your name')[0]!, 'Andrew');
    await user.click(create);
    expect(calls.rpcs[0]![0]).toBe('create_household');
    expect(calls.rpcs[0]![1]).toMatchObject({ p_name: 'Home', p_display_name: 'Andrew' });
    expect(await screen.findByText(/, Andrew$/)).toBeInTheDocument();
  });

  it('shows the dashboard with real household members and navigation', async () => {
    const { client } = fakeClient({ session: SESSION, query: householdHandler() });
    render(<AppWithClient client={client} />);
    const household = (await screen.findByRole('heading', { name: 'Household' })).closest('section')!;
    expect(within(household).getByText('Andrew')).toBeInTheDocument();
    expect(within(household).getByText('Sam')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Today', 'Tasks', 'Shopping', 'Calendar', 'Watch', 'Casa', 'Settings']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('unbuilt sections say so and offer no fake controls', async () => {
    const { client } = fakeClient({ session: SESSION, query: householdHandler() });
    render(<AppWithClient client={client} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: 'Tasks' }));
    expect(await screen.findByText('Tasks isn’t built yet')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryAllByRole('button')).toHaveLength(0);
  });

  it('shows an honest error with retry when the household fails to load', async () => {
    const { client } = fakeClient({
      session: SESSION,
      query: () => ({ data: null, error: { code: 'PGRST106', message: 'The schema must be one of the following: public' } }),
    });
    render(<AppWithClient client={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Exposed schemas');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('saves the theme to member settings', async () => {
    const { client, calls } = fakeClient({ session: SESSION, query: householdHandler() });
    window.history.pushState({}, '', '/settings');
    render(<AppWithClient client={client} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Dark' }));
    const update = calls.queries.find((q) => q.table === 'member_settings' && q.op === 'update');
    expect(update?.payload).toEqual({ theme: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');
    window.history.pushState({}, '', '/');
  });

  it('shows the reconnecting banner when Realtime is down', async () => {
    const { client } = fakeClient({ session: SESSION, query: householdHandler(), realtimeStatus: 'CHANNEL_ERROR' });
    render(<AppWithClient client={client} />);
    await screen.findByRole('heading', { name: 'Household' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2700));
    });
    expect(screen.getByText('Reconnecting to Ovie…')).toBeInTheDocument();
  });
});
