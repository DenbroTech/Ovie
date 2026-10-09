import { resolveTheme, applyTheme, storedTheme } from './theme';

describe('theme', () => {
  it('resolves the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });
  it('applies and remembers a choice', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(storedTheme()).toBe('dark');
  });
});
