export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatClock(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
}

export function formatLongDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone,
  }).format(date);
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney';
  } catch {
    return 'Australia/Sydney';
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
