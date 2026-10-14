import { POSTIT_CHOICES, postitColour, postitTilt } from '../../lib/postits';
import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Pencil, Pin, Plus, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { NoteFace } from '../../components/NoteFace';
import { DoodlePad } from './DoodlePad';
import { GifPicker } from './GifPicker';
import { emptyDoodle, hasDoodle, parseDoodle, type Doodle } from '../../lib/doodle';
import { gifKeyFrom } from '../../lib/gifs';
import { notePicture, uploadNotePicture, useNotePictures } from '../../lib/notePictures';
import { BUCKET } from '../../lib/photos';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { PersonPicker } from '../../components/PersonPicker';
import { Empty, LoadError, Spinner } from '../../components/States';
import { notesMood } from '../../lib/moods';
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
  image_path: string | null;
  gif_url: string | null;
  doodle: unknown;
}
type NoteColour = 'sand' | 'sage' | 'sky' | 'clay' | 'plum';
const COLS = 'id,body,from_member,to_member,colour,pinned,done_at,created_at,image_path,gif_url,doodle';

/** Does this note have a picture, GIF or drawing (so it shows as a square face)? */
export const isRich = (n: Pick<Note, 'image_path' | 'gif_url' | 'doodle'>) => !!(n.image_path || n.gif_url || hasDoodle(parseDoodle(n.doodle)));

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
  const [editing, setEditing] = useState<Note | null>(null);

  const live = useLive<Note[]>('notes', hid, ['notes'], () =>
    supabase.from('notes').select(COLS).eq('household_id', hid!)
      .or(`done_at.is.null,done_at.gt.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`)
      .order('created_at', { ascending: false }));
  const notes = live.data ?? [];
  const open = sortNotes(notes.filter((n) => !n.done_at));
  const done = notes.filter((n) => n.done_at);
  const name = (id: string | null) => members.find((m) => m.id === id)?.display_name;
  const urls = useNotePictures(notes.map((n) => n.image_path));

  async function patch(n: Note, change: Partial<Note>, msg?: string) {
    live.setData((rows) => rows?.map((r) => (r.id === n.id ? { ...r, ...change } : r)) ?? rows);
    const { error } = await supabase.from('notes').update(change).eq('id', n.id);
    if (error) { toast(friendlyError(error), 'error'); void live.reload(); } else if (msg) toast(msg);
  }
  async function remove(n: Note) {
    const { error } = await supabase.from('notes').delete().eq('id', n.id);
    if (error) toast(friendlyError(error), 'error'); else toast('Deleted');
    if (!error && n.image_path) void supabase.storage.from(BUCKET).remove([n.image_path]);
    void live.reload();
  }

  const list = showDone ? done : open;
  return (
    <Screen title="Notes" sheep={notesMood(open, me?.id ?? null)} actions={
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
                <li key={n.id} data-ref={n.id} className={`note postit-${postitColour(n.colour)}`} style={{ '--tilt': `${postitTilt(n.id)}deg` } as React.CSSProperties}>
                  <div className="note-head">
                    <span className="note-to">{n.to_member ? `For ${n.to_member === me?.id ? 'you' : name(n.to_member) ?? 'someone'}` : 'For everyone'}</span>
                    {n.pinned && <Pin size={16} aria-label="Pinned" />}
                  </div>
                  {isRich(n)
                    ? <NoteFace body={n.body} picture={notePicture(n, urls)} doodle={parseDoodle(n.doodle)} />
                    : <p className="note-body">{n.body}</p>}
                  <div className="note-foot">
                    <span className="note-from">{name(n.from_member) ? `${name(n.from_member)} · ` : ''}{when(n.created_at)}</span>
                    {!n.done_at ? (
                      <span className="note-actions">
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Change or draw on this note"
                          onClick={() => setEditing(n)}><Pencil size={20} /></button>
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
      {(writing || editing) && hid && (
        <NoteEditor householdId={hid} me={me} members={members} note={editing} pictureUrl={editing ? notePicture(editing, urls) : null}
          gifKey={gifKeyFrom(household?.settings)}
          onClose={() => { setWriting(false); setEditing(null); }}
          onSaved={() => { setWriting(false); setEditing(null); setShowDone(false); void live.reload(); }} />
      )}
    </Screen>
  );
}

type Picture =
  | { kind: 'file'; file: File; url: string }
  | { kind: 'gif'; url: string }
  | { kind: 'stored'; path: string; url: string | null };

/** Write a new note or change one: words, a photo or GIF, and a drawing on top. */
function NoteEditor({ householdId, me, members, note, pictureUrl, gifKey, onClose, onSaved }: {
  householdId: string; me: Member | null; members: Member[]; note: Note | null; pictureUrl: string | null;
  gifKey: ReturnType<typeof gifKeyFrom>; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { connected } = useConnection();
  const others = members.filter((m) => m.id !== me?.id);
  const [body, setBody] = useState(note?.body ?? '');
  const [to, setTo] = useState<string | null>(note ? note.to_member : others.length === 1 ? others[0].id : null);
  const [colour, setColour] = useState<NoteColour>(note?.colour ?? 'sand');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [picture, setPicture] = useState<Picture | null>(
    note?.gif_url ? { kind: 'gif', url: note.gif_url } : note?.image_path ? { kind: 'stored', path: note.image_path, url: pictureUrl } : null);
  const [doodle, setDoodle] = useState<Doodle>(parseDoodle(note?.doodle) ?? emptyDoodle());
  const [mode, setMode] = useState<'write' | 'draw'>('write');
  const [gifs, setGifs] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // let go of the preview of a chosen photo
  const fileUrl = picture?.kind === 'file' ? picture.url : null;
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const shownPicture = picture?.url ?? null;
  const drawn = hasDoodle(doodle);
  const canSave = !!body.trim() || !!picture || drawn;

  function choose(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('That file is not a picture.', 'error'); return; }
    setPicture({ kind: 'file', file, url: URL.createObjectURL(file) });
    setGifs(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function save() {
    setBusy(true);
    try {
      let image_path: string | null = picture?.kind === 'stored' ? picture.path : null;
      if (picture?.kind === 'file') image_path = await uploadNotePicture(householdId, picture.file);
      const row = {
        body: body.trim(), to_member: to, colour, pinned,
        image_path, gif_url: picture?.kind === 'gif' ? picture.url : null, doodle: drawn ? doodle : null,
      };
      const { error } = note
        ? await supabase.from('notes').update(row).eq('id', note.id)
        : await supabase.from('notes').insert({ ...row, household_id: householdId, from_member: me?.id ?? null });
      if (error) {
        if (picture?.kind === 'file' && image_path) void supabase.storage.from(BUCKET).remove([image_path]);
        throw error;
      }
      // the old picture isn't needed any more
      if (note?.image_path && note.image_path !== image_path) void supabase.storage.from(BUCKET).remove([note.image_path]);
      toast(note ? 'Note changed' : 'Note left');
      onSaved();
    } catch (err) {
      toast(friendlyError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={note ? 'Change the note' : 'Leave a note'} onClose={onClose} onSubmit={() => void save()} busy={busy}
      canSubmit={canSave} submitLabel={note ? 'Save' : 'Leave note'}>
      <div className="segmented" role="group" aria-label="Write or draw">
        <button type="button" aria-pressed={mode === 'write'} onClick={() => setMode('write')}>Write</button>
        <button type="button" aria-pressed={mode === 'draw'} onClick={() => { setMode('draw'); setGifs(false); }}>
          <Pencil size={16} /> Draw{drawn ? ' ✓' : ''}
        </button>
      </div>

      {mode === 'draw' ? (
        <DoodlePad body={body} picture={shownPicture} doodle={doodle} onChange={setDoodle} postit={postitColour(colour)} />
      ) : (
        <>
          <div className="field">
            <label htmlFor="n-body">Note</label>
            <textarea id="n-body" autoFocus={!note} maxLength={1000} rows={3} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Gone to the gym, back at 7. Dinner's in the fridge!" />
          </div>

          <div className="field">
            <span className="field-label">Picture</span>
            <div className="note-pic-row">
              <button type="button" className="btn btn-secondary" disabled={!connected} onClick={() => fileInput.current?.click()}>
                <ImagePlus size={18} /> Photo
              </button>
              <button type="button" className="btn btn-secondary" aria-pressed={gifs} disabled={!connected} onClick={() => setGifs((g) => !g)}>
                <Sparkles size={18} /> GIF
              </button>
              {picture && (
                <button type="button" className="btn btn-ghost" onClick={() => setPicture(null)}><X size={18} /> Take it off</button>
              )}
            </div>
            {!connected && <p className="muted small">Adding a photo or GIF needs the internet. Words and drawings save offline.</p>}
            <input ref={fileInput} type="file" accept="image/*" hidden aria-label="Choose a photo" onChange={(e) => choose(e.target.files)} />
            {gifs && <GifPicker gifKey={gifKey} onPick={(url) => { setPicture({ kind: 'gif', url }); setGifs(false); }} />}
          </div>

          {(picture || drawn) && (
            <div className={`note-preview postit-${postitColour(colour)}`}>
              <NoteFace body={body} picture={shownPicture} doodle={doodle} />
            </div>
          )}

          <div className="field">
            <span className="field-label">For</span>
            <PersonPicker members={members} value={to} onChange={setTo} label="For" />
          </div>
          <div className="field">
            <span className="field-label">Colour</span>
            <div className="swatches" role="radiogroup" aria-label="Note colour">
              {POSTIT_CHOICES.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={colour === c.value} aria-label={c.label}
                  className={`swatch postit-${postitColour(c.value)}`} onClick={() => setColour(c.value)} />
              ))}
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            <span>Pin to the top</span>
          </label>
        </>
      )}
    </Sheet>
  );
}
