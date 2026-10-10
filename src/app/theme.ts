import { createContext, useContext, useEffect } from 'react';
import type { ThemePref } from '../lib/types';

const KEY = 'ovie-theme';
const NIGHT_KEY = 'ovie-night';
export const NIGHT_EVENT = 'ovie-night-changed';

/** When "Automatic" goes dark: the home's own times and time zone (shared by every device). */
export interface NightSchedule { from: string; until: string; timeZone?: string }
export const DEFAULT_NIGHT: NightSchedule = { from: '19:00', until: '07:00' };

export function storedTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

export function storedNight(): NightSchedule {
  try {
    const v = JSON.parse(localStorage.getItem(NIGHT_KEY) ?? 'null');
    if (v && /^\d\d:\d\d$/.test(v.from) && /^\d\d:\d\d$/.test(v.until)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_NIGHT;
}

/** Remember the home's night times on this device (so the theme is right even before Ovie loads). */
export function rememberNight(s: NightSchedule) {
  try {
    const before = localStorage.getItem(NIGHT_KEY);
    const next = JSON.stringify(s);
    if (before === next) return;
    localStorage.setItem(NIGHT_KEY, next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(NIGHT_EVENT));
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Is it night (dark time) right now in the home's time zone? Handles windows that cross midnight. */
export function isNight(now: Date, s: NightSchedule): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: s.timeZone })
    .formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const t = h * 60 + m;
  const from = minutes(s.from);
  const until = minutes(s.until);
  if (from === until) return false;
  return from < until ? t >= from && t < until : t >= from || t < until;
}

export function resolveTheme(pref: ThemePref, night: boolean): 'light' | 'dark' {
  if (pref === 'system') return night ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: ThemePref, now = new Date()) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.theme = resolveTheme(pref, isNight(now, storedNight()));
}

/** Keeps <html data-theme> in sync: fixed light/dark, or "Automatic" = dark during the home's night hours. */
export function useTheme(pref: ThemePref) {
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const update = () => applyTheme('system');
    const id = window.setInterval(update, 60_000);
    window.addEventListener(NIGHT_EVENT, update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(NIGHT_EVENT, update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [pref]);
}

/** Theme is a per-device choice (the wall screen may want dark while phones follow the schedule). */
export const ThemeContext = createContext<{ theme: ThemePref; setTheme: (t: ThemePref) => void }>({
  theme: 'system',
  setTheme: () => {},
});
export const useThemeChoice = () => useContext(ThemeContext);
