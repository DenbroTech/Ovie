import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const rpc = vi.fn();
vi.mock('../../lib/supabase', () => ({ configError: null, supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const refresh = vi.fn();
vi.mock('../../app/HouseholdProvider', () => ({ useHousehold: () => ({ refresh }) }));
let online = true;
vi.mock('../../app/ConnectionProvider', () => ({ useConnection: () => ({ online, reportRealtime: () => {} }) }));

import { PairDevice, SetupHousehold } from './Onboarding';

beforeEach(() => { rpc.mockReset(); refresh.mockReset(); online = true; });

describe('PairDevice', () => {
  it('pairs a phone to an existing person with no login', async () => {
    rpc.mockImplementation((fn: string) =>
      fn === 'people_for_code'
        ? Promise.resolve({ data: [{ id: 'a1', display_name: 'Andrew', colour: 'sage' }, { id: 'l1', display_name: 'Lina', colour: 'clay' }], error: null })
        : Promise.resolve({ data: 'h', error: null }));
    render(<PairDevice />);
    await userEvent.type(screen.getByLabelText('Home code'), 'abcd-efgh');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: /Lina/ }));
    expect(rpc).toHaveBeenLastCalledWith('pair_device', { p_code: 'abcd-efgh', p_kind: 'personal', p_member_id: 'l1' });
    expect(refresh).toHaveBeenCalled();
  });

  it('pairs the wall screen as shared', async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'people_for_code' ? { data: [{ id: 'a1', display_name: 'Andrew', colour: 'sage' }], error: null } : { data: 'h', error: null }));
    render(<PairDevice />);
    await userEvent.type(screen.getByLabelText('Home code'), 'ABCD-EFGH');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: /Wall screen/ }));
    expect(rpc).toHaveBeenLastCalledWith('pair_device', { p_code: 'ABCD-EFGH', p_kind: 'wall' });
  });

  it('says so when the code is wrong (and shows no names)', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    render(<PairDevice />);
    await userEvent.type(screen.getByLabelText('Home code'), 'NOPE-NOPE');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/);
    expect(screen.queryByRole('button', { name: /Wall screen/ })).not.toBeInTheDocument();
  });

  it('adds someone new', async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'people_for_code' ? { data: [{ id: 'a1', display_name: 'Andrew', colour: 'sage' }], error: null } : { data: 'h', error: null }));
    render(<PairDevice />);
    await userEvent.type(screen.getByLabelText('Home code'), 'ABCD-EFGH');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: /Someone new/ }));
    await userEvent.type(screen.getByLabelText('Their name'), 'Maria');
    await userEvent.click(screen.getByRole('button', { name: 'Add and continue' }));
    expect(rpc).toHaveBeenLastCalledWith('pair_device', { p_code: 'ABCD-EFGH', p_kind: 'personal', p_new_person_name: 'Maria' });
  });
});

describe('SetupHousehold', () => {
  it('creates the home on the very first device', async () => {
    rpc.mockResolvedValue({ data: 'h', error: null });
    render(<SetupHousehold />);
    await userEvent.type(screen.getByLabelText('Your name'), 'Andrew');
    await userEvent.click(within(screen.getByRole('form', { name: 'Set up Ovie' })).getByRole('button', { name: 'Start' }));
    expect(rpc).toHaveBeenCalledWith('setup_household', expect.objectContaining({ p_name: 'Our home', p_person_name: 'Andrew', p_kind: 'personal' }));
  });

  it('pauses while offline', () => {
    online = false;
    render(<SetupHousehold />);
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
