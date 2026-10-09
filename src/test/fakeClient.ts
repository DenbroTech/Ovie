import type { OvieClient } from '../lib/supabase';

export interface Query {
  table: string;
  op: 'select' | 'update' | 'insert' | 'delete';
  filters: [string, string, unknown][];
  payload?: unknown;
  single: boolean;
}

type Result = { data: unknown; error: unknown };
type QueryHandler = (q: Query) => Result;
type RpcHandler = (fn: string, args: Record<string, unknown>) => Result;

/** Minimal stand-in for the Supabase client: enough of the query builder for Ovie's screens. */
export function fakeClient(opts: {
  session?: { user: { id: string; email: string } } | null;
  query?: QueryHandler;
  rpc?: RpcHandler;
  realtimeStatus?: string;
}) {
  const calls: { queries: Query[]; rpcs: [string, Record<string, unknown>][] } = { queries: [], rpcs: [] };
  const authListeners = new Set<(e: string, s: unknown) => void>();
  let session = opts.session ?? null;

  const from = (table: string) => {
    const q: Query = { table, op: 'select', filters: [], single: false };
    const builder: Record<string, unknown> = {};
    const chain = (name: string, fn?: (...a: unknown[]) => void) => {
      builder[name] = (...args: unknown[]) => {
        fn?.(...args);
        return builder;
      };
    };
    chain('select');
    chain('update', (p) => { q.op = 'update'; q.payload = p; });
    chain('insert', (p) => { q.op = 'insert'; q.payload = p; });
    chain('delete', () => { q.op = 'delete'; });
    for (const f of ['eq', 'gt', 'is', 'neq', 'lt', 'in']) chain(f, (col, val) => q.filters.push([f, col as string, val]));
    chain('order');
    chain('limit');
    chain('single', () => { q.single = true; });
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => {
      calls.queries.push(q);
      try {
        return Promise.resolve(opts.query ? opts.query(q) : { data: null, error: null }).then(resolve, reject);
      } catch (e) {
        return Promise.reject(e).then(resolve, reject);
      }
    };
    return builder;
  };

  const client = {
    from,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.rpcs.push([fn, args]);
      return opts.rpc ? opts.rpc(fn, args) : { data: null, error: null };
    },
    channel: () => {
      const ch = {
        subscribe: (cb: (s: string) => void) => {
          queueMicrotask(() => cb(opts.realtimeStatus ?? 'SUBSCRIBED'));
          return ch;
        },
      };
      return ch;
    },
    removeChannel: async () => 'ok',
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (password !== 'right') return { data: null, error: { message: 'Invalid login credentials' } };
        session = { user: { id: 'u1', email } };
        authListeners.forEach((cb) => cb('SIGNED_IN', session));
        return { data: { session }, error: null };
      },
      signOut: async () => {
        session = null;
        authListeners.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      },
    },
  };

  return { client: client as unknown as OvieClient, calls };
}

export const HOUSEHOLD_ID = 'h1';
export const OWNER = { household_id: HOUSEHOLD_ID, user_id: 'u1', role: 'owner', display_name: 'Andrew', colour: 'sage', joined_at: '2026-10-01T00:00:00Z' };
export const PARTNER = { household_id: HOUSEHOLD_ID, user_id: 'u2', role: 'member', display_name: 'Sam', colour: 'clay', joined_at: '2026-10-02T00:00:00Z' };

/** Query handler for a signed-in member of a loaded household. */
export function householdHandler(members = [OWNER, PARTNER], extra?: QueryHandler): QueryHandler {
  const mySettings = { household_id: HOUSEHOLD_ID, user_id: 'u1', theme: 'system', prefs: {} };
  return (q) => {
    const r = extra?.(q);
    if (r) return r;
    switch (q.table) {
      case 'household_members':
        if (q.op !== 'select') return { data: null, error: null };
        if (q.filters.some(([, c]) => c === 'user_id')) {
          const uid = q.filters.find(([, c]) => c === 'user_id')![2];
          return { data: members.filter((m) => m.user_id === uid).map((m) => ({ household_id: m.household_id })), error: null };
        }
        return { data: members, error: null };
      case 'households':
        return { data: { id: HOUSEHOLD_ID, name: 'Home', timezone: 'Australia/Sydney', created_at: '2026-10-01T00:00:00Z' }, error: null };
      case 'household_settings':
        return { data: { household_id: HOUSEHOLD_ID, week_starts_on: 1, prefs: {} }, error: null };
      case 'member_settings':
        if (q.op === 'update') Object.assign(mySettings, q.payload);
        return { data: { ...mySettings }, error: null };
      case 'household_invites':
        return { data: [], error: null };
      default:
        return { data: null, error: { message: `unexpected table ${q.table}` } };
    }
  };
}
