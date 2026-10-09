import { slideDirection } from './Shell';
import { APPS } from './apps';

vi.mock('../lib/supabase', () => ({ supabase: {}, configError: null }));

describe('navigation', () => {
  it('slides forward into apps and back to home', () => {
    expect(slideDirection('/settings', { dir: 'forward' })).toBe('forward');
    expect(slideDirection('/', { dir: 'back' })).toBe('back');
    expect(slideDirection('/', null)).toBe('none');
    expect(slideDirection('/settings', null)).toBe('forward');
  });

  it('only lists apps that exist (no dead buttons)', () => {
    expect(APPS.map((a) => a.id)).toEqual(['settings']);
  });
});

