import { configureOffline, flushOutbox, offlineFetch, outbox, SYNC_EVENT } from './offline';

const API = 'https://x.supabase.co/rest/v1';
let online = true;
const sent: Array<{ url: string; method: string; auth: string | null; body: string | null }> = [];
let server: Record<string, unknown> = {};

function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!online) return Promise.reject(new TypeError('Failed to fetch'));
  const url = String(input);
  const method = (init.method ?? 'GET').toUpperCase();
  if (method === 'GET') return Promise.resolve(new Response(JSON.stringify(server[url] ?? []), { status: 200, headers: { 'content-type': 'application/json' } }));
  sent.push({ url, method, auth: new Headers(init.headers).get('authorization'), body: (init.body as string) ?? null });
  return Promise.resolve(new Response(null, { status: method === 'POST' ? 201 : 204 }));
}

const get = async (url: string) => (await offlineFetch(url, { method: 'GET' })).json();
const tasksUrl = `${API}/tasks?select=id,title,completed_at&household_id=eq.h&completed_at=is.null&order=due_on.asc`;

beforeEach(() => {
  localStorage.clear();
  online = true;
  sent.length = 0;
  server = { [tasksUrl]: [{ id: 't1', title: 'Bins out', completed_at: null, household_id: 'h' }, { id: 't2', title: 'Dentist', completed_at: null, household_id: 'h' }] };
  configureOffline({ fetch: fakeFetch as typeof fetch, token: async () => 'fresh-token' });
});

describe('offline-first data', () => {
  it('shows the last saved answer when there is no connection', async () => {
    expect((await get(tasksUrl)).length).toBe(2);
    online = false;
    expect((await get(tasksUrl)).map((t: { id: string }) => t.id)).toEqual(['t1', 't2']);
  });

  it('keeps changes made offline, shows them straight away, and sends them in order later', async () => {
    await get(tasksUrl);
    online = false;
    // tick a job off (an update) and add a new one (an insert)
    await offlineFetch(`${API}/tasks?id=eq.t1`, { method: 'PATCH', headers: { authorization: 'Bearer old', 'content-type': 'application/json' }, body: JSON.stringify({ completed_at: '2026-10-13T10:00:00Z' }) });
    const res = await offlineFetch(`${API}/tasks?select=*`, { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ title: 'Water plants', household_id: 'h', completed_at: null }) });
    expect(res.status).toBe(201);
    const [added] = await res.json();
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/);
    // the saved list already reflects both: t1 gone (no longer matches completed_at=is.null), the new one added
    expect((await get(tasksUrl)).map((t: { title: string }) => t.title)).toEqual(['Dentist', 'Water plants']);
    expect(outbox().length).toBe(2);

    online = true;
    let synced = 0;
    window.addEventListener(SYNC_EVENT, () => synced++);
    await flushOutbox();
    expect(sent.map((s) => s.method)).toEqual(['PATCH', 'POST']);
    expect(sent[0].auth).toBe('Bearer fresh-token');
    expect(JSON.parse(sent[1].body!).id).toBe(added.id); // the server gets the same id the screen used
    expect(outbox()).toEqual([]);
    expect(synced).toBe(1);
  });

  it('ticking a job via complete_task offline takes it off the to-do list', async () => {
    await get(tasksUrl);
    online = false;
    const res = await offlineFetch(`${API}/rpc/complete_task`, { method: 'POST', body: JSON.stringify({ p_task_id: 't2', p_by: null }) });
    expect(res.ok).toBe(true);
    expect((await get(tasksUrl)).map((t: { id: string }) => t.id)).toEqual(['t1']);
  });

  it('deletes offline remove the row from saved lists', async () => {
    await get(tasksUrl);
    online = false;
    await offlineFetch(`${API}/tasks?id=eq.t1`, { method: 'DELETE' });
    expect((await get(tasksUrl)).map((t: { id: string }) => t.id)).toEqual(['t2']);
  });

  it('things that need the server (pairing) still fail offline instead of pretending', async () => {
    online = false;
    await expect(offlineFetch(`${API}/rpc/pair_device`, { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(outbox()).toEqual([]);
  });

  it('a read never seen before still fails offline', async () => {
    online = false;
    await expect(get(`${API}/notes?select=*`)).rejects.toThrow();
  });
});

describe('stableUrl', () => {
  it('keys a query on the day, not the exact moment', async () => {
    const { stableUrl } = await import('./offline');
    const a = stableUrl('https://x/rest/v1/tasks?or=(completed_at.is.null,completed_at.gt.2026-09-14T08:27:01.123Z)');
    const b = stableUrl('https://x/rest/v1/tasks?or=(completed_at.is.null,completed_at.gt.2026-09-14T09:59:44.900Z)');
    expect(a).toBe(b);
    expect(a).toContain('2026-09-14)');
    expect(stableUrl('https://x/rest/v1/events?starts_at=gte.2026-10-13T23%3A00%3A00.000Z')).toBe('https://x/rest/v1/events?starts_at=gte.2026-10-13');
  });
});
