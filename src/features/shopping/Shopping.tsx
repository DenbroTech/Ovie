import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Eraser, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { shoppingMood } from '../../lib/moods';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';

interface List { id: string; name: string; sort: number }
export interface Item {
  id: string;
  list_id: string;
  name: string;
  qty: string | null;
  note: string | null;
  checked_at: string | null;
  cleared_at: string | null;
  created_at: string;
}

const LAST_LIST = 'ovie-shopping-list';

/** Things bought before on this list that aren't on it now, most often bought first. */
export function buyAgain(items: Item[], listId: string, limit = 10): string[] {
  const open = new Set(items.filter((i) => i.list_id === listId && !i.cleared_at).map((i) => i.name.trim().toLowerCase()));
  const counts = new Map<string, { name: string; n: number; last: string }>();
  for (const i of items) {
    if (i.list_id !== listId || !i.cleared_at) continue;
    const key = i.name.trim().toLowerCase();
    if (open.has(key)) continue;
    const c = counts.get(key);
    if (c) { c.n += 1; if (i.created_at > c.last) c.last = i.created_at; }
    else counts.set(key, { name: i.name.trim(), n: 1, last: i.created_at });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1)).slice(0, limit).map((c) => c.name);
}

export function ShoppingScreen() {
  const { household, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const hid = household?.id;
  const [listId, setListId] = useState<string | null>(() => {
    try { return localStorage.getItem(LAST_LIST); } catch { return null; }
  });
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [newList, setNewList] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const lists = useLive<List[]>('lists', hid, ['shopping_lists'], () =>
    supabase.from('shopping_lists').select('id,name,sort').eq('household_id', hid!).order('sort').order('created_at'));
  // Open items plus the last few months of history (for "buy again").
  const items = useLive<Item[]>('items', hid, ['shopping_items'], () =>
    supabase.from('shopping_items').select('id,list_id,name,qty,note,checked_at,cleared_at,created_at')
      .eq('household_id', hid!)
      .or(`cleared_at.is.null,created_at.gt.${new Date(Date.now() - 120 * 86_400_000).toISOString()}`)
      .order('created_at'));

  const allLists = lists.data ?? [];
  const current = allLists.find((l) => l.id === listId) ?? allLists[0];
  useEffect(() => {
    if (current) try { localStorage.setItem(LAST_LIST, current.id); } catch { /* ignore */ }
  }, [current]);

  const all = items.data ?? [];
  const here = all.filter((i) => i.list_id === current?.id && !i.cleared_at);
  const toBuy = here.filter((i) => !i.checked_at);
  const ticked = here.filter((i) => i.checked_at).sort((a, b) => (a.checked_at! < b.checked_at! ? 1 : -1));
  const again = useMemo(() => (current ? buyAgain(all, current.id) : []), [all, current]);
  const openCount = (id: string) => all.filter((i) => i.list_id === id && !i.cleared_at && !i.checked_at).length;

  async function add(itemName: string, itemQty: string | null) {
    if (!hid || !current) return;
    const n = itemName.trim();
    if (!n) return;
    const dupe = here.find((i) => !i.checked_at && i.name.trim().toLowerCase() === n.toLowerCase() && (i.qty ?? '') === (itemQty ?? ''));
    if (dupe) { toast(`${n} is already on the list`); return; }
    const temp: Item = { id: `tmp-${Date.now()}`, list_id: current.id, name: n, qty: itemQty, note: null, checked_at: null, cleared_at: null, created_at: new Date().toISOString() };
    items.setData((rows) => (rows ? [...rows, temp] : rows));
    const { error } = await supabase.from('shopping_items').insert({
      household_id: hid, list_id: current.id, name: n, qty: itemQty || null, added_by: me?.id ?? null,
    });
    if (error) toast(friendlyError(error), 'error');
    void items.reload();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name; const q = qty.trim() || null;
    setName(''); setQty('');
    await add(n, q);
  }

  async function toggle(item: Item) {
    const checked = !item.checked_at;
    items.setData((rows) => rows?.map((r) => (r.id === item.id ? { ...r, checked_at: checked ? new Date().toISOString() : null } : r)) ?? rows);
    const { error } = await supabase.from('shopping_items')
      .update({ checked_at: checked ? new Date().toISOString() : null, checked_by: checked ? me?.id ?? null : null })
      .eq('id', item.id);
    if (error) { toast(friendlyError(error), 'error'); void items.reload(); }
  }

  async function clearTicked() {
    const ids = ticked.map((i) => i.id);
    const { error } = await supabase.from('shopping_items').update({ cleared_at: new Date().toISOString() }).in('id', ids);
    if (error) toast(friendlyError(error), 'error');
    else toast(`Cleared ${ids.length} ticked`);
    void items.reload();
  }

  const error = lists.error ?? items.error;
  return (
    <Screen title="Shopping" sheep={shoppingMood(toBuy.length)} actions={
      <button type="button" className="btn btn-secondary btn-icon" aria-label="New list" disabled={!online} onClick={() => setNewList(true)}>
        <ListPlus size={24} />
      </button>
    }>
      <div className="module">
        {error ? <LoadError message={error} onRetry={() => { void lists.reload(); void items.reload(); }} />
          : lists.loading || items.loading ? <Spinner />
          : !current ? <Empty title="No lists yet">Tap the list button at the top to make one.</Empty> : (
            <>
              <div className="chips" style={{ marginBottom: 'var(--s-3)' }} role="tablist" aria-label="Lists">
                {allLists.map((l) => {
                  const n = openCount(l.id);
                  return (
                    <button key={l.id} type="button" role="tab" className="chip-btn plain" aria-selected={l.id === current.id}
                      aria-pressed={l.id === current.id} onClick={() => setListId(l.id)}>
                      {l.name}{n ? ` · ${n}` : ''}
                    </button>
                  );
                })}
              </div>

              <form className="quick-add" onSubmit={submit} aria-label={`Add to ${current.name}`}>
                <input aria-label="Item" placeholder={`Add to ${current.name}…`} value={name} maxLength={80}
                  onChange={(e) => setName(e.target.value)} disabled={!online} />
                <input aria-label="How many" placeholder="Qty" value={qty} maxLength={20} style={{ flex: '0 0 5.5rem' }}
                  onChange={(e) => setQty(e.target.value)} disabled={!online} />
                <button className="btn btn-primary btn-icon" aria-label="Add item" disabled={!online || !name.trim()}><Plus size={24} /></button>
              </form>

              {again.length > 0 && (
                <div className="buy-again">
                  <span className="group-label" style={{ margin: 0 }}>Buy again</span>
                  <div className="chips">
                    {again.map((a) => (
                      <button key={a} type="button" className="chip-btn plain" disabled={!online} onClick={() => void add(a, null)}>
                        <Plus size={16} /> {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {here.length === 0 ? <Empty title={`${current.name} is empty`}>Add something above.</Empty> : (
                <>
                  <ul className="list">
                    {toBuy.map((i) => <ItemRow key={i.id} item={i} disabled={!online} onToggle={() => void toggle(i)} onEdit={() => setEditing(i)} />)}
                  </ul>
                  {toBuy.length === 0 && <p className="muted" style={{ textAlign: 'center', margin: 'var(--s-4) 0' }}>All done! 🎉</p>}
                  {ticked.length > 0 && (
                    <>
                      <div className="row" style={{ justifyContent: 'space-between', margin: 'var(--s-4) 0 var(--s-2)' }}>
                        <h3 className="group-label" style={{ margin: 0 }}>In the trolley ({ticked.length})</h3>
                        <button type="button" className="btn btn-secondary" disabled={!online} onClick={() => setConfirmClear(true)}>
                          <Eraser size={18} /> Clear ticked
                        </button>
                      </div>
                      <ul className="list">
                        {ticked.map((i) => <ItemRow key={i.id} item={i} disabled={!online} onToggle={() => void toggle(i)} onEdit={() => setEditing(i)} />)}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )}
      </div>

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void items.reload(); }} />}
      {newList && hid && <ListSheet householdId={hid} count={allLists.length} onClose={() => setNewList(false)}
        onSaved={(id) => { setNewList(false); setListId(id); void lists.reload(); }} />}
      {confirmClear && (
        <ConfirmDialog title={`Clear ${ticked.length} ticked item${ticked.length === 1 ? '' : 's'}?`}
          body='They leave the list but stay under "Buy again".' confirmLabel="Clear"
          onCancel={() => setConfirmClear(false)} onConfirm={async () => { await clearTicked(); setConfirmClear(false); }} />
      )}
    </Screen>
  );
}

function ItemRow({ item, disabled, onToggle, onEdit }: { item: Item; disabled: boolean; onToggle: () => void; onEdit: () => void }) {
  const done = !!item.checked_at;
  return (
    <li className={`row-item shop-item${done ? ' is-done' : ''}`}>
      <button type="button" className="row-main shop-tap" role="checkbox" aria-checked={done} disabled={disabled} onClick={onToggle}>
        <span className="tick" aria-hidden="true" data-on={done}>{done && <Check size={24} />}</span>
        <span>
          <span className="row-title">{item.name}</span>
          {(item.qty || item.note) && <span className="row-meta">{[item.qty, item.note].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
      <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${item.name}`} disabled={disabled} onClick={onEdit}>
        <Pencil size={20} />
      </button>
    </li>
  );
}

function ItemSheet({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('shopping_items').update({ name: name.trim(), qty: qty.trim() || null, note: note.trim() || null }).eq('id', item.id);
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else onSaved();
  }
  async function remove() {
    setBusy(true);
    const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast(`Removed ${item.name}`); onSaved(); }
  }

  return (
    <Sheet title="Edit item" onClose={onClose} onSubmit={() => void save()} busy={busy} canSubmit={!!name.trim()}
      footer={<button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove()}><Trash2 size={18} /> Remove</button>}>
      <div className="field">
        <label htmlFor="i-name">Item</label>
        <input id="i-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="i-qty">How many</label>
          <input id="i-qty" maxLength={20} placeholder="e.g. 2, 1 kg" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="i-note">Note</label>
          <input id="i-note" maxLength={200} placeholder="e.g. the green one" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}

function ListSheet({ householdId, count, onClose, onSaved }: { householdId: string; count: number; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { data, error } = await supabase.from('shopping_lists').insert({ household_id: householdId, name: name.trim(), sort: count }).select('id').single();
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else onSaved((data as { id: string }).id);
  }
  return (
    <Sheet title="New list" onClose={onClose} onSubmit={() => void save()} busy={busy} canSubmit={!!name.trim()} submitLabel="Make list">
      <div className="field">
        <label htmlFor="l-name">List name</label>
        <input id="l-name" required autoFocus maxLength={40} placeholder="e.g. Pharmacy, Bunnings" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </Sheet>
  );
}
