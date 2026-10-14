/** "What's new": changes anyone in the house made (recorded by the database), worded for people,
 *  grouped when someone does lots of the same thing at once, and linked to where the change is. */

export type ActivityKind = 'task' | 'shopping' | 'note' | 'event' | 'meal' | 'title' | 'viewing' | 'photo' | 'meter';
export type ActivityAction = 'added' | 'changed' | 'done' | 'undone' | 'deleted' | 'liked';

export interface ActivityRow {
  id: number;
  actor_user: string | null;
  actor_member: string | null;
  actor_device: string | null;
  kind: ActivityKind;
  action: ActivityAction;
  ref_id: string | null;
  title: string;
  info: Record<string, unknown> | null;
  created_at: string;
}
export const ACTIVITY_COLS = 'id,actor_user,actor_member,actor_device,kind,action,ref_id,title,info,created_at';

export interface ActivityItem {
  key: string;
  rows: ActivityRow[];
  /** who did it ("Lina", "The wall screen", or "You") */
  who: string;
  colour: string | null;
  text: string;
  path: string;
  /** the thing to show when you get there */
  ref: string | null;
  /** the day to open on the calendar */
  day?: string;
  at: string;
  mine: boolean;
  unread: boolean;
}

export const PATHS: Record<ActivityKind, string> = {
  task: '/tasks', shopping: '/shopping', note: '/notes', event: '/calendar', meal: '/menu', title: '/watch', viewing: '/watch', photo: '/photos', meter: '/oviemeter',
};

/** Things that are often done in a burst read better as one line. */
const BURSTY = new Set(['shopping:added', 'shopping:done', 'photo:added', 'task:done', 'task:added']);
const BURST_MS = 15 * 60_000;

const q = (s: string) => `“${s}”`;
function list(titles: string[]): string {
  const t = [...new Set(titles.filter(Boolean))];
  if (t.length <= 1) return t[0] ?? '';
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  if (t.length === 3) return `${t[0]}, ${t[1]} and ${t[2]}`;
  return `${t[0]}, ${t[1]} and ${t.length - 2} more`;
}

function dayText(iso: unknown, timeZone?: string): string {
  if (typeof iso !== 'string') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(d);
}

/** The sentence after the person's name. */
export function describe(rows: ActivityRow[], meId: string | null, timeZone?: string, nameOf: (id: string | null) => string | null = () => null): string {
  const r = rows[0];
  const titles = rows.map((x) => x.title);
  const many = rows.length > 1;
  const info = r.info ?? {};
  switch (r.kind) {
    case 'task':
      if (r.action === 'added') return many ? `added jobs: ${list(titles)}` : `added the job ${q(r.title)}`;
      if (r.action === 'done') return many ? `ticked off ${list(titles)}` : `ticked off ${q(r.title)}`;
      if (r.action === 'undone') return `put ${q(r.title)} back on the jobs`;
      if (r.action === 'deleted') return `deleted the job ${q(r.title)}`;
      return `changed the job ${q(r.title)}`;
    case 'shopping':
      if (r.action === 'added') return `added ${list(titles)} to the shopping`;
      if (r.action === 'done') return `got ${list(titles)}`;
      return `changed ${q(r.title)} on the shopping`;
    case 'note': {
      const forMe = !!meId && info.to_member === meId;
      const what = r.title ? `: ${q(r.title)}` : info.picture ? ' with a picture' : info.drawing ? ' with a drawing' : '';
      if (r.action === 'added') return `${forMe ? 'left you a note' : 'left a note'}${what}`;
      if (r.action === 'done') return `took a note off the board${what}`;
      if (r.action === 'liked') return `❤️ liked ${meId && info.note_from === meId ? 'your' : 'a'} note${what}`;
      return `changed a note${what}`;
    }
    case 'event': {
      const when = info.starts_at ? ` · ${dayText(info.starts_at, timeZone)}` : '';
      if (r.action === 'added') return `added ${q(r.title)} to the calendar${when}`;
      if (r.action === 'deleted') return `took ${q(r.title)} off the calendar${when}`;
      return `changed ${q(r.title)} on the calendar${when}`;
    }
    case 'meal': {
      const when = dayText(info.starts_at, timeZone);
      if (r.action === 'deleted') return `took ${r.title} off the menu${when ? ` for ${when}` : ''}`;
      return `planned ${r.title}${when ? ` for ${when}` : ''}`;
    }
    case 'title': {
      if (r.action === 'added') return `added ${q(r.title)} to Watch`;
      const status = String(info.status ?? '');
      const word = status === 'watching' ? 'started watching' : status === 'done' ? 'finished' : status === 'paused' ? 'paused'
        : status === 'want' ? 'wants to watch' : 'changed';
      return `${word} ${q(r.title)}`;
    }
    case 'viewing': {
      const s = Number(info.season), e = Number(info.episode);
      return `watched ${q(r.title)}${s > 0 && e > 0 ? ` S${s} E${e}` : ''}`;
    }
    case 'meter': {
      const pts = Number(info.points) || 0;
      const to = typeof info.to_member === 'string' ? info.to_member : null;
      const target = to && to === meId ? 'you' : nameOf(to) ?? 'someone';
      const why = r.title ? `: ${q(r.title)}` : '';
      // points from a job's reward: say who earned them
      if (info.task && pts > 0) return `earned +${pts} on the Oviemeter 😇 for doing ${q(r.title.replace(/^Did the job: /, ''))}`;
      return pts > 0
        ? `gave ${target} +${pts} on the Oviemeter 😇${why}`
        : `took ${-pts} point${pts === -1 ? '' : 's'} off ${target} on the Oviemeter 😈${why}`;
    }
    case 'photo':
      return many ? `added ${rows.length} photos` : 'added a photo';
  }
}

/** Turn rows (newest first) into lines, grouping bursts by the same person. */
export function activityItems(rows: ActivityRow[], opts: {
  myUserId: string | null; meId: string | null; seenAt: string | null; timeZone?: string;
  memberName: (id: string | null) => { name: string; colour: string | null } | null;
  deviceName: (id: string | null) => string | null;
}): ActivityItem[] {
  const groups: ActivityRow[][] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    const prev = g?.[g.length - 1];
    const same = prev && BURSTY.has(`${r.kind}:${r.action}`) && prev.kind === r.kind && prev.action === r.action
      && prev.actor_user === r.actor_user && new Date(prev.created_at).getTime() - new Date(r.created_at).getTime() <= BURST_MS;
    if (same) g.push(r); else groups.push([r]);
  }
  return groups.map((g) => {
    const r = g[0];
    const mine = !!opts.myUserId && r.actor_user === opts.myUserId;
    // on the wall screen the giver is picked, so name them rather than the device
    const giver = r.kind !== 'meter' ? null
      : r.info?.task && typeof r.info.to_member === 'string' ? r.info.to_member // a job's reward: the person who earned it
      : typeof r.info?.from_member === 'string' ? r.info.from_member : null;
    const person = opts.memberName(giver ?? r.actor_member);
    const who = mine ? 'You' : person?.name ?? opts.deviceName(r.actor_device) ?? 'Someone';
    const day = (r.kind === 'event' || r.kind === 'meal') && typeof r.info?.starts_at === 'string' ? r.info.starts_at : undefined;
    return {
      key: g.map((x) => x.id).join('-'), rows: g, who, colour: mine ? null : person?.colour ?? null,
      text: describe(g, opts.meId, opts.timeZone, (id) => opts.memberName(id)?.name ?? null), path: PATHS[r.kind], ref: r.action === 'deleted' ? null : r.ref_id, day,
      at: r.created_at, mine, unread: !mine && (!opts.seenAt || r.created_at > opts.seenAt),
    };
  });
}

/** How many changes by other people this device hasn't seen yet. */
export function unreadCount(rows: ActivityRow[], myUserId: string | null, seenAt: string | null): number {
  return rows.filter((r) => r.actor_user !== myUserId && (!seenAt || r.created_at > seenAt)).length;
}

const SEEN_KEY = 'ovie-activity-seen';
export function seenAt(): string | null {
  try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
}
export function markSeen(at = new Date().toISOString()): void {
  try { localStorage.setItem(SEEN_KEY, at); } catch { /* private window: it just shows again */ }
  window.dispatchEvent(new Event('ovie-activity-seen'));
}

export function ago(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
