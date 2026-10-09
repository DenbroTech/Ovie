import { useEffect } from 'react';
import type { ThemePref } from '../lib/types';

const KEY = 'ovie-theme';

export function storedTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  document.documentElement.dataset.theme = resolveTheme(pref, dark);
}

/** Keeps <html data-theme> in sync with the preference and the OS setting. */
export function useTheme(pref: ThemePref) {
  useEffect(() => {
    applyTheme(pref);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq || pref !== 'system') return;
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
}
