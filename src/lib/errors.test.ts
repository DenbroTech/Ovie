import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('explains network failures', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/can't reach/i);
  });
  it('explains an unexposed schema', () => {
    expect(friendlyError({ code: 'PGRST106', message: 'The schema must be one of the following: public' }))
      .toMatch(/Exposed schemas/);
  });
  it('explains a wrong code and switched-off anonymous sign-ins', () => {
    expect(friendlyError({ message: 'invite code not recognised', code: 'P0002' })).toMatch(/code is not right/);
    expect(friendlyError({ message: 'Anonymous sign-ins are disabled' })).toMatch(/Allow anonymous sign-ins/);
  });
  it('maps permission errors', () => {
    expect(friendlyError({ code: '42501', message: 'only an owner can change roles' })).toMatch(/permission/);
  });
  it('falls back to the original message', () => {
    expect(friendlyError({ message: 'Something odd' })).toBe('Something odd');
    expect(friendlyError(null)).toBe('Something went wrong.');
  });
});
