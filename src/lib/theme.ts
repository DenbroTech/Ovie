import type { ThemePref } from './db-types';

const KEY = 'ovie.theme';

/** Applies a theme preference to <html> and remembers it for the next first paint. */
export function applyTheme(pref: ThemePref, root: HTMLElement = document.documentElement): void {
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // storage may be unavailable (private mode); the theme still applies now
  }
}

export function storedTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return 'system';
}
