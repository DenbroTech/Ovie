/**
 * Offline-first data for Ovie. Every request Supabase makes goes through `offlineFetch`:
 * - Reads (GET/HEAD, read-only RPCs, photo links) are answered from the network and the answer is saved on
 *   this device; with no connection the saved answer is used, so screens keep showing the last info.
 * - Changes (insert/update/delete and write RPCs) made with no connection are kept in an outbox on this device,
 *   applied straight away to the saved answers (so the screen updates), and sent in order once back online.
 * Only the `/rest/v1/` API and photo links are handled here; sign-in and uploads go straight to the network.
 */
type Row = Record<string, unknown>;
interface Saved { status: number; headers: Record<string, string>; body: string; at: number }
export interface Queued { id: string; url: string; method: string; headers: Record<string, string>; body: string | null; at: number }

const CACHE_PREFIX = 'ovie-c:';
const OUTBOX_KEY = 'ovie-outbox';
export const SYNC_EVENT = 'ovie-synced';
export const STATUS_EVENT = 'ovie-connection';

/** RPCs that only read (safe to answer from the saved copy). Anything else is a change. */
const READ_RPCS = new Set(['casa_summary', 'casa_trend', 'setup_state', 'household_today', 'people_for_code']);
/** Changes that make no sense later (just "I'm here" pings): dropped when offline. */
const DROP_RPCS = new Set(['touch_device']);
/** Changes that can't be done offline (need the server to answer): fail as usual. */
const ONLINE_ONLY_RPCS = new Set(['pair_device', 'setup_household', 'regenerate_invite_code']);

let baseFetch: typeof fetch = (...a) => fetch(...a);
let tokenGetter: () => Promise<string | null> = async () => null;
let connected = true;
/** How long to wait for the internet before showing the saved copy instead. */
const SLOW_MS = 6000;

/** For tests and wiring: the real fetch, and how to get the current sign-in token when replaying the outbox. */
export function configureOffline(opts: { fetch?: typeof fetch; token?: () => Promise<string | null> }) {
  if (opts.fetch) baseFetch = opts.fetch;
  if (opts.token) tokenGetter = opts.token;
}

export const isConnected = () => connected;
function setConnected(v: boolean) {
  if (connected === v) return;
  connected = v;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STATUS_EVENT));
}

// ---------- storage ----------
// Saved answers live in IndexedDB (room for hundreds of MB), kept in memory while Ovie runs. localStorage only
// holds ~5 MB: once full, the oldest answers were dropped, and the household itself (loaded once at start-up)
// was usually the oldest, so a later offline start had nothing to show. The outbox stays in localStorage (small).

const DB_NAME = 'ovie-cache';
const DB_STORE = 'kv';
const KEEP_DAYS = 30;
const mem = new Map<string, string>();
let db: IDBDatabase | null = null;
let readyP: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(DB_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

/** Load the saved answers into memory (once), moving any old localStorage copies across and dropping stale ones. */
export function cacheReady(): Promise<void> {
  if (readyP) return readyP;
  readyP = (async () => {
    if (typeof indexedDB === 'undefined') return;
    const opened = await Promise.race([openDb(), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    if (!opened) return;
    const all = await new Promise<Array<[string, string]>>((resolve) => {
      const out: Array<[string, string]> = [];
      try {
        const cur = opened.transaction(DB_STORE).objectStore(DB_STORE).openCursor();
        cur.onsuccess = () => { const c = cur.result; if (c) { out.push([String(c.key), String(c.value)]); c.continue(); } else resolve(out); };
        cur.onerror = () => resolve(out);
      } catch { resolve(out); }
    });
    db = opened;
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    for (const [k, v] of all) {
      let at = 0; try { at = JSON.parse(v).at ?? 0; } catch { /* keep */ }
      if (at && at < cutoff) idbDel(k); else mem.set(k, v);
    }
    // move answers saved by older versions out of localStorage (frees it for the outbox and sign-in)
    try {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(CACHE_PREFIX)) continue;
        const v = localStorage.getItem(k);
        if (v !== null && !mem.has(k)) { mem.set(k, v); idbPut(k, v); }
        localStorage.removeItem(k);
      }
    } catch { /* no localStorage */ }
  })();
  return readyP;
}

function idbPut(key: string, value: string) {
  try { db?.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(value, key); } catch { /* memory still has it */ }
}
function idbDel(key: string) {
  try { db?.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(key); } catch { /* ignore */ }
}

const local = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch {
      // full: drop the oldest saved answers (never the outbox) and try once more
      try {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
        keys.sort((a, b) => (JSON.parse(localStorage.getItem(a) ?? '{}').at ?? 0) - (JSON.parse(localStorage.getItem(b) ?? '{}').at ?? 0));
        for (const k of keys.slice(0, Math.ceil(keys.length / 3))) localStorage.removeItem(k);
        localStorage.setItem(key, value);
      } catch { /* give up quietly */ }
    }
  },
  keys(): string[] { try { return Object.keys(localStorage); } catch { return []; } },
};

/** Saved answers: IndexedDB-backed memory when available, else localStorage (older browsers, tests). */
const store = {
  get(key: string): string | null { return db ? mem.get(key) ?? null : local.get(key); },
  set(key: string, value: string) { if (db) { mem.set(key, value); idbPut(key, value); } else local.set(key, value); },
  keys(): string[] { return db ? [...mem.keys()] : local.keys(); },
};

export function outbox(): Queued[] {
  try { return JSON.parse(local.get(OUTBOX_KEY) ?? '[]'); } catch { return []; }
}
const saveOutbox = (q: Queued[]) => {
  local.set(OUTBOX_KEY, JSON.stringify(q));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STATUS_EVENT));
};

// ---------- request helpers ----------

function headersOf(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  new Headers(h).forEach((v, k) => { out[k.toLowerCase()] = v; });
  return out;
}

function kindOf(url: URL, method: string): 'read' | 'write' | 'drop' | 'online' | 'pass' {
  const path = url.pathname;
  if (path.includes('/storage/v1/object/sign/')) return method === 'POST' ? 'read' : 'pass';
  if (!path.includes('/rest/v1/')) return 'pass';
  const rpc = path.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
  if (rpc) return READ_RPCS.has(rpc) ? 'read' : DROP_RPCS.has(rpc) ? 'drop' : ONLINE_ONLY_RPCS.has(rpc) ? 'online' : 'write';
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}

const tableOf = (url: URL) => url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)?.[1] ?? null;
/** Exact timestamps in a query (e.g. "done in the last 30 days" measured from now) change on every visit;
 *  key on the day instead so the last copy is found offline. */
export const stableUrl = (url: string) =>
  url.replace(/(\d{4}-\d{2}-\d{2})T\d{2}(?::|%3A)\d{2}(?::|%3A)\d{2}(?:\.\d+)?(?:Z|%2B\d{2}(?::|%3A)\d{2}|\+\d{2}:\d{2})?/gi, '$1');
const cacheKey = (method: string, url: string, body: string | null) => `${CACHE_PREFIX}${method} ${stableUrl(url)}${body ? ` ${body}` : ''}`;

// ---------- PostgREST filters (enough of them to keep saved answers right) ----------

const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
type Filter = { col: string; op: string; val: string; not: boolean };

export function filtersOf(url: URL): Filter[] {
  const out: Filter[] = [];
  url.searchParams.forEach((v, col) => {
    if (NOT_FILTERS.has(col)) return;
    let not = false, rest = v;
    if (rest.startsWith('not.')) { not = true; rest = rest.slice(4); }
    const dot = rest.indexOf('.');
    if (dot < 0) return;
    out.push({ col, op: rest.slice(0, dot), val: rest.slice(dot + 1), not });
  });
  return out;
}

function compare(a: unknown, b: string): number {
  const x = typeof a === 'number' ? a : Number(a), y = Number(b);
  if (a !== null && a !== undefined && a !== '' && !Number.isNaN(x) && !Number.isNaN(y) && typeof a !== 'boolean') return x - y;
  return String(a ?? '').localeCompare(b);
}

export function rowMatches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ col, op, val, not }) => {
    const v = row[col];
    let ok: boolean;
    switch (op) {
      case 'eq': ok = v !== null && v !== undefined && String(v) === val; break;
      case 'neq': ok = v !== null && v !== undefined && String(v) !== val; break;
      case 'is': ok = val === 'null' ? v === null || v === undefined : String(v) === val; break;
      case 'gt': ok = v != null && compare(v, val) > 0; break;
      case 'gte': ok = v != null && compare(v, val) >= 0; break;
      case 'lt': ok = v != null && compare(v, val) < 0; break;
      case 'lte': ok = v != null && compare(v, val) <= 0; break;
      case 'in': ok = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v)); break;
      default: ok = true; // a filter we don't understand: assume it matches
    }
    return not ? !ok : ok;
  });
}

// ---------- applying an offline change to the saved answers ----------

function eachSavedRead(table: string, fn: (url: URL, rows: Row[], single: boolean) => Row[] | null) {
  for (const key of store.keys()) {
    if (!key.startsWith(`${CACHE_PREFIX}GET `)) continue;
    const url = new URL(key.slice(`${CACHE_PREFIX}GET `.length));
    if (tableOf(url) !== table) continue;
    const saved: Saved = JSON.parse(store.get(key) ?? 'null');
    if (!saved) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(saved.body); } catch { continue; }
    const single = !Array.isArray(parsed);
    const rows = (single ? [parsed] : parsed) as Row[];
    const next = fn(url, rows, single);
    if (!next) continue;
    store.set(key, JSON.stringify({ ...saved, body: JSON.stringify(single ? next[0] ?? null : next) }));
  }
}

export function applyLocally(table: string, method: string, url: URL, body: unknown) {
  const where = filtersOf(url);
  if (method === 'PATCH') {
    eachSavedRead(table, (readUrl, rows) => {
      const own = filtersOf(readUrl);
      return rows.map((r) => (rowMatches(r, where) ? { ...r, ...(body as Row) } : r)).filter((r) => rowMatches(r, own));
    });
  } else if (method === 'DELETE') {
    eachSavedRead(table, (_u, rows) => rows.filter((r) => !rowMatches(r, where)));
  } else if (method === 'POST') {
    const added = (Array.isArray(body) ? body : [body]) as Row[];
    const conflict = url.searchParams.get('on_conflict')?.split(',') ?? ['id'];
    eachSavedRead(table, (readUrl, rows) => {
      const own = filtersOf(readUrl);
      let next = rows;
      for (const row of added) {
        if (!rowMatches(row, own)) continue;
        const same = (r: Row) => conflict.every((c) => String(r[c]) === String(row[c]));
        next = next.some(same) ? next.map((r) => (same(r) ? { ...r, ...row } : r)) : [...next, row];
      }
      return next;
    });
  }
}

/** What a write RPC does, for the saved answers (the server does the real work when it's sent). */
function applyRpcLocally(name: string, args: Row) {
  const now = new Date().toISOString();
  const byId = (id: unknown) => new URL(`http://x/rest/v1/tasks?id=eq.${String(id)}`);
  if (name === 'complete_task') applyLocally('tasks', 'PATCH', byId(args.p_task_id), { completed_at: now, completed_by: args.p_by ?? null });
  if (name === 'uncomplete_task') applyLocally('tasks', 'PATCH', byId(args.p_task_id), { completed_at: null, completed_by: null });
}

// ---------- the fetch ----------

function respond(saved: Saved): Response {
  return new Response(saved.status === 204 ? null : saved.body, { status: saved.status, headers: saved.headers });
}

function isNetworkError(e: unknown) {
  return e instanceof TypeError || (e instanceof DOMException && e.name !== 'AbortError');
}

export async function offlineFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(urlStr);
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const kind = kindOf(url, method);
  if (kind === 'pass') return baseFetch(input, init);
  const body = typeof init.body === 'string' ? init.body : null;

  await Promise.race([cacheReady(), new Promise((r) => setTimeout(r, 3000))]);

  if (kind === 'read') {
    const key = cacheKey(method, urlStr, method === 'POST' ? body : null);
    const savedNow = (): Saved | null => { try { return JSON.parse(store.get(key) ?? 'null'); } catch { return null; } };
    const live = (async () => {
      const res = await baseFetch(input, init);
      setConnected(true);
      if (res.ok) {
        const text = await res.clone().text();
        const keep: Record<string, string> = {};
        for (const h of ['content-type', 'content-range']) { const v = res.headers.get(h); if (v) keep[h] = v; }
        store.set(key, JSON.stringify({ status: res.status, headers: keep, body: text, at: Date.now() } satisfies Saved));
        if (outbox().length) void flushOutbox();
      }
      // the server itself is having trouble, or the sign-in is still being renewed: the last good answer beats an error page
      const fallback = res.status >= 500 || res.status === 401 ? savedNow() : null;
      return fallback ? respond(fallback) : res;
    })();
    // A connection that's there but crawling (phone hotspot, weak Wi-Fi): after a few seconds show the saved copy;
    // the real answer still arrives and is saved, and the screen refreshes from it next time.
    const saved = savedNow();
    try {
      if (!saved) return await live;
      const slow = new Promise<'slow'>((r) => setTimeout(() => r('slow'), SLOW_MS));
      const first = await Promise.race([live, slow]);
      if (first === 'slow') { live.catch(() => setConnected(false)); return respond(saved); }
      return first;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      setConnected(false);
      const again = savedNow();
      if (again) return respond(again);
      throw e;
    }
  }

  // a change
  try {
    if (outbox().length) await flushOutbox(); // keep changes in order
    const res = await baseFetch(input, init);
    setConnected(true);
    return res;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    setConnected(false);
    if (kind === 'online') throw e;
    if (kind === 'drop') return new Response(null, { status: 204 });
    const headers = headersOf(init.headers);
    delete headers.authorization; // a fresh sign-in token is used when it's sent
    let parsed: unknown = body ? JSON.parse(body) : null;
    const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    const table = tableOf(url);
    if (method === 'POST' && table && parsed) {
      // give new rows their id now, so the screen and the server agree on it
      const now = new Date().toISOString();
      const withIds = (Array.isArray(parsed) ? parsed : [parsed]).map((r: Row) => ({ id: crypto.randomUUID(), created_at: now, ...r }));
      parsed = Array.isArray(parsed) ? withIds : withIds[0];
    }
    const sendBody = parsed === null ? null : JSON.stringify(parsed);
    const q = outbox();
    q.push({ id: crypto.randomUUID(), url: urlStr, method, headers, body: sendBody, at: Date.now() });
    saveOutbox(q);
    if (rpc) applyRpcLocally(rpc, (parsed ?? {}) as Row);
    else if (table) applyLocally(table, method, url, parsed);
    // answer as the server would
    const wantsRows = (headers.prefer ?? '').includes('return=representation');
    if (rpc) return new Response('null', { status: 200, headers: { 'content-type': 'application/json' } });
    if (wantsRows && parsed !== null) {
      const single = (headers.accept ?? '').includes('vnd.pgrst.object');
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return new Response(JSON.stringify(single ? rows[0] : rows), { status: method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(null, { status: method === 'POST' ? 201 : 204 });
  }
}

// ---------- sending the outbox ----------

let flushing: Promise<void> | null = null;

/** Send waiting changes in order. Stops at the first network failure; drops changes the server refuses. */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      for (;;) {
        const [next] = outbox();
        if (!next) break;
        const token = await tokenGetter();
        const headers = { ...next.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) };
        let res: Response;
        try {
          res = await baseFetch(next.url, { method: next.method, headers, body: next.body });
        } catch (e) {
          if (isNetworkError(e)) { setConnected(false); break; }
          throw e;
        }
        setConnected(true);
        if (res.status === 401) break; // sign-in not refreshed yet: try again shortly
        // sent (or refused for good, e.g. it was deleted meanwhile): either way it leaves the outbox
        saveOutbox(outbox().filter((q) => q.id !== next.id));
        sent++;
      }
    } finally {
      flushing = null;
      if (sent && typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_EVENT));
    }
  })();
  return flushing;
}

/** Keep trying to send the outbox: when the browser says it's back online, and every 20 seconds. */
export function startOutboxSync(): () => void {
  const kick = () => { if (outbox().length) void flushOutbox(); };
  window.addEventListener('online', kick);
  const id = window.setInterval(kick, 20_000);
  kick();
  return () => { window.removeEventListener('online', kick); window.clearInterval(id); };
}
