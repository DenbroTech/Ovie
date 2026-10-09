import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('confirms once even if tapped twice quickly', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<ConfirmDialog title="Remove Lina?" confirmLabel="Remove" danger onConfirm={onConfirm} onCancel={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Remove' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
    resolve();
  });

  it('cancels with Escape', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Sign out?" confirmLabel="Sign out" onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
