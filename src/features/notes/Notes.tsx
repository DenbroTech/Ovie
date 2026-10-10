import { useState } from 'react';
import { Check, Pin, Plus, Trash2, Undo2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { PersonPicker } from '../../components/PersonPicker';
import { Empty, LoadError, Spinner } from '../../components/States';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';
import type { Member } from '../../lib/types';

export interface Note {
  id: string;
  body: string;
  from_member: string | null;
  to_member: string | null;
  colour: NoteColour;
  pinned: boolean;
  done_at: string | null;
  created_at: string;
}
type NoteColour = 'sand' | 'sage' | 'sky' | 'clay' | 'plum';
const COLOURS: NoteColour[] = ['sand', 'sage', 'sky', 'clay', 'plum'];
const COLS = 'id,body,from_member,to_member,colour,pinned,done_at,created_at';

/** Pinned first, then newest. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.created_at < b.created_at ? 1 : -1));
}

export function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function NotesScreen() {
  const { household, members, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const hid = household?.id;
  const [showDone, setShowDone] = useState(false);
  const [writing, setWriting] = useState(false);

  const live = useLive<Note[]>('notes', hid, ['notes'], () =>
    supabase.from('notes').select(COLS).eq('household_id', hid!)
      .or(`done_at.is.null,done_at.gt.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`)
      .order('created_at', { ascending: false }));
  const notes = live.data ?? [];
  const open = sortNotes(notes.filter((n) => !n.done_at));
  const done = notes.filter((n) => n.done_at);
  const name = (id: string | null) => members.find((m) => m.id === id)?.display_name;

  async function patch(n: Note, change: Partial<Note>, msg?: string) {
    live.setData((rows) => rows?.map((r) => (r.id === n.id ? { ...r, ...change } : r)) ?? rows);
    const { error } = await supabase.from('notes').update(change).eq('id', n.id);
    if (error) { toast(friendlyError(error), 'error'); void live.reload(); } else if (msg) toast(msg);
  }
  async function remove(n: Note) {
    const { error } = await supabase.from('notes').delete().eq('id', n.id);
    if (error) toast(friendlyError(error), 'error'); else toast('Deleted');
    void live.reload();
  }

  const list = showDone ? done : open;
  return (
    <Screen title="Notes" actions={
      <button type="button" className="btn btn-primary btn-icon" aria-label="Write a note" disabled={!online} onClick={() => setWriting(true)}>
        <Plus size={26} />
      </button>
    }>
      <div className="module">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" aria-pressed={!showDone} onClick={() => setShowDone(false)}>On the board{open.length ? ` (${open.length})` : ''}</button>
            <button type="button" aria-pressed={showDone} onClick={() => setShowDone(true)}>Done</button>
          </div>
        </div>
        {live.error ? <LoadError message={live.error} onRetry={() => void live.reload()} />
          : live.loading ? <Spinner />
          : list.length === 0 ? (
            showDone ? <Empty title="Nothing here yet">Notes you tick off stay here for 30 days.</Empty>
              : <Empty title="The board is empty">Tap + to leave a note for someone.</Empty>
          ) : (
            <ul className="note-board">
              {list.map((n) => (
                <li key={n.id} className={`note note-${n.colour}`}>
                  <div className="note-head">
                    <span className="note-to">{n.to_member ? `For ${n.to_member === me?.id ? 'you' : name(n.to_member) ?? 'someone'}` : 'For everyone'}</span>
                    {n.pinned && <Pin size={16} aria-label="Pinned" />}
                  </div>
                  <p className="note-body">{n.body}</p>
                  <div className="note-foot">
                    <span className="note-from">{name(n.from_member) ? `${name(n.from_member)} · ` : ''}{when(n.created_at)}</span>
                    {!n.done_at ? (
                      <span className="note-actions">
                        <button type="button" className="btn btn-ghost btn-icon" aria-label={n.pinned ? 'Unpin' : 'Pin to the top'} aria-pressed={n.pinned}
                          disabled={!online} onClick={() => void patch(n, { pinned: !n.pinned })}><Pin size={20} /></button>
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Done, take it off the board" disabled={!online}
                          onClick={() => void patch(n, { done_at: new Date().toISOString(), pinned: false }, 'Taken off the board')}><Check size={22} /></button>
                      </span>
                    ) : (
                      <span className="note-actions">
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Put back on the board" disabled={!online}
                          onClick={() => void patch(n, { done_at: null }, 'Back on the board')}><Undo2 size={20} /></button>
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Delete for good" disabled={!online}
                          onClick={() => void remove(n)}><Trash2 size={20} /></button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>
      {writing && hid && <WriteNote householdId={hid} me={me} members={members} onClose={() => setWriting(false)}
        onSaved={() => { setWriting(false); setShowDone(false); void live.reload(); }} />}
    </Screen>
  );
}

function WriteNote({ householdId, me, members, onClose, onSaved }: {
  householdId: string; me: Member | null; members: Member[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const others = members.filter((m) => m.id !== me?.id);
  const [body, setBody] = useState('');
  const [to, setTo] = useState<string | null>(others.length === 1 ? others[0].id : null);
  const [colour, setColour] = useState<NoteColour>('sand');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('notes').insert({
      household_id: householdId, body: body.trim(), from_member: me?.id ?? null, to_member: to, colour, pinned,
    });
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast('Note left'); onSaved(); }
  }

  return (
    <Sheet title="Leave a note" onClose={onClose} onSubmit={() => void save()} busy={busy} canSubmit={!!body.trim()} submitLabel="Leave note">
      <div className="field">
        <label htmlFor="n-body">Note</label>
        <textarea id="n-body" required autoFocus maxLength={1000} rows={4} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Gone to the gym, back at 7. Dinner's in the fridge!" />
      </div>
      <div className="field">
        <span className="field-label">For</span>
        <PersonPicker members={members} value={to} onChange={setTo} label="For" />
      </div>
      <div className="field">
        <span className="field-label">Colour</span>
        <div className="swatches" role="radiogroup" aria-label="Note colour">
          {COLOURS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={colour === c} aria-label={c}
              className={`swatch note-${c}`} onClick={() => setColour(c)} />
          ))}
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <span>Pin to the top</span>
      </label>
    </Sheet>
  );
}
