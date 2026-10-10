import { useMemo, useState } from 'react';
import { Check, Film, Plus, Trash2, Tv, Undo2, Users } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';
import { nextEpisode, parseSeasons, totalEpisodes } from '../../lib/dates';
import type { Member } from '../../lib/types';

type Status = 'want' | 'watching' | 'paused' | 'done' | 'dropped';
export interface Title {
  id: string;
  kind: 'show' | 'film';
  name: string;
  year: number | null;
  status: Status;
  seasons: number[];
  rating: number | null;
  notes: string | null;
}
export interface Viewing { id: string; title_id: string; member_id: string | null; season: number; episode: number; watched_on: string; created_at: string }

const STATUS_LABEL: Record<Status, string> = { want: 'Want to watch', watching: 'Watching', paused: 'Paused', done: 'Finished', dropped: 'Gave up' };
type Tab = 'watching' | 'want' | 'done';
const TAB_STATUSES: Record<Tab, Status[]> = { watching: ['watching', 'paused'], want: ['want'], done: ['done', 'dropped'] };

/** "together" or a member id. */
type Viewer = 'together' | string;
const viewerKey = (member_id: string | null): Viewer => member_id ?? 'together';
const ep = (s: number, e: number) => `S${s} E${e}`;

export function WatchScreen() {
  const { household, members, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const hid = household?.id;
  const [tab, setTab] = useState<Tab>('watching');
  const [viewer, setViewer] = useState<Viewer>('together');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Title | null>(null);

  const titles = useLive<Title[]>('titles', hid, ['titles'], () =>
    supabase.from('titles').select('id,kind,name,year,status,seasons,rating,notes').eq('household_id', hid!).order('updated_at', { ascending: false }));
  const views = useLive<Viewing[]>('viewings', hid, ['viewings'], () =>
    supabase.from('viewings').select('id,title_id,member_id,season,episode,watched_on,created_at').eq('household_id', hid!));

  const all = titles.data ?? [];
  const shown = all.filter((t) => TAB_STATUSES[tab].includes(t.status));
  const viewsFor = (titleId: string, v: Viewer) =>
    (views.data ?? []).filter((x) => x.title_id === titleId && viewerKey(x.member_id) === v);

  async function markWatched(t: Title, season: number, episode: number) {
    const member_id = viewer === 'together' ? null : viewer;
    const { error } = await supabase.from('viewings').upsert(
      { household_id: hid, title_id: t.id, member_id, season, episode },
      { onConflict: 'title_id,member_id,season,episode', ignoreDuplicates: true });
    if (error) { toast(friendlyError(error), 'error'); return; }
    if (t.status === 'want' || t.status === 'paused') await supabase.from('titles').update({ status: 'watching' }).eq('id', t.id);
    const watchedNow = [...viewsFor(t.id, viewer), { season, episode } as Viewing];
    if (t.kind === 'film' || nextEpisode(t.seasons, watchedNow) === null) {
      await supabase.from('titles').update({ status: 'done' }).eq('id', t.id);
      toast(t.kind === 'film' ? `Watched ${t.name}` : `Finished ${t.name}! 🎉`);
    } else toast(`Watched ${ep(season, episode)}`);
    void views.reload(); void titles.reload();
  }

  async function undoLast(t: Title) {
    const mine = viewsFor(t.id, viewer).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (!mine[0]) return;
    const { error } = await supabase.from('viewings').delete().eq('id', mine[0].id);
    if (error) toast(friendlyError(error), 'error');
    else toast(t.kind === 'film' ? 'Undone' : `Undid ${ep(mine[0].season, mine[0].episode)}`);
    void views.reload();
  }

  const error = titles.error ?? views.error;
  return (
    <Screen title="Watch" actions={
      <button type="button" className="btn btn-primary btn-icon" aria-label="Add a show or film" disabled={!online} onClick={() => setAdding(true)}>
        <Plus size={26} />
      </button>
    }>
      <div className="module">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" aria-pressed={tab === 'watching'} onClick={() => setTab('watching')}>Watching</button>
            <button type="button" aria-pressed={tab === 'want'} onClick={() => setTab('want')}>Want to watch</button>
            <button type="button" aria-pressed={tab === 'done'} onClick={() => setTab('done')}>Finished</button>
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 'var(--s-3)' }} role="radiogroup" aria-label="Who's watching">
          <button type="button" role="radio" className="chip-btn" aria-checked={viewer === 'together'} onClick={() => setViewer('together')}>
            <span className="avatar chip-avatar everyone"><Users size={16} /></span>Together
          </button>
          {members.map((m) => (
            <button key={m.id} type="button" role="radio" className="chip-btn plain" aria-checked={viewer === m.id} onClick={() => setViewer(m.id)}>
              {m.id === me?.id ? `Just me` : `Just ${m.display_name}`}
            </button>
          ))}
        </div>

        {error ? <LoadError message={error} onRetry={() => { void titles.reload(); void views.reload(); }} />
          : titles.loading || views.loading ? <Spinner />
          : shown.length === 0 ? (
            <Empty title={tab === 'want' ? 'Your watchlist is empty' : tab === 'watching' ? 'Not watching anything' : 'Nothing finished yet'}>
              Tap + to add a show or film.
            </Empty>
          ) : (
            <ul className="watch-list">
              {shown.map((t) => (
                <TitleCard key={t.id} title={t} watched={viewsFor(t.id, viewer)} disabled={!online}
                  onWatch={(s, e) => void markWatched(t, s, e)} onUndo={() => void undoLast(t)} onOpen={() => setOpen(t)} />
              ))}
            </ul>
          )}
      </div>

      {adding && hid && <AddTitleSheet householdId={hid} myId={me?.id ?? null} onClose={() => setAdding(false)}
        onSaved={(status) => { setAdding(false); setTab(status === 'want' ? 'want' : 'watching'); void titles.reload(); }} />}
      {open && hid && (
        <TitleSheet title={open} householdId={hid} viewer={viewer} members={members} views={views.data ?? []}
          onClose={() => setOpen(null)} onChanged={() => { void titles.reload(); void views.reload(); }} />
      )}
    </Screen>
  );
}

function TitleCard({ title, watched, disabled, onWatch, onUndo, onOpen }: {
  title: Title; watched: Viewing[]; disabled: boolean; onWatch: (s: number, e: number) => void; onUndo: () => void; onOpen: () => void;
}) {
  const total = totalEpisodes(title.seasons);
  const next = title.kind === 'show' ? nextEpisode(title.seasons, watched) : null;
  const seen = title.kind === 'film' ? watched.length > 0 : false;
  return (
    <li className="watch-card">
      <button type="button" className="watch-poster" onClick={onOpen} aria-label={`Open ${title.name}`}>
        {title.kind === 'film' ? <Film size={30} /> : <Tv size={30} />}
      </button>
      <div className="watch-body">
        <button type="button" className="row-main" onClick={onOpen}>
          <span className="row-title">{title.name}{title.year ? <span className="muted"> ({title.year})</span> : null}</span>
          <span className="row-meta">
            {STATUS_LABEL[title.status]}
            {title.kind === 'show' && total > 0 && <span>{watched.length} of {total} episodes</span>}
            {title.kind === 'show' && total === 0 && <span>Add episode counts to track progress</span>}
          </span>
        </button>
        {title.kind === 'show' && total > 0 && (
          <div className="progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (watched.length / total) * 100)}%` }} /></div>
        )}
        <div className="watch-actions">
          {title.kind === 'show' && next && (
            <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => onWatch(next.season, next.episode)}>
              <Check size={18} /> Watched {ep(next.season, next.episode)}
            </button>
          )}
          {title.kind === 'show' && !next && total > 0 && <span className="muted">All caught up</span>}
          {title.kind === 'film' && !seen && (
            <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => onWatch(0, 0)}><Check size={18} /> Watched it</button>
          )}
          {watched.length > 0 && (
            <button type="button" className="btn btn-secondary" disabled={disabled} onClick={onUndo}><Undo2 size={18} /> Undo</button>
          )}
        </div>
      </div>
    </li>
  );
}

function AddTitleSheet({ householdId, myId, onClose, onSaved }: {
  householdId: string; myId: string | null; onClose: () => void; onSaved: (status: Status) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<'show' | 'film'>('show');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [seasonsText, setSeasonsText] = useState('');
  const [status, setStatus] = useState<Status>('want');
  const [busy, setBusy] = useState(false);
  const seasons = kind === 'show' ? parseSeasons(seasonsText) : [];
  const yearNum = year ? Number(year) : null;
  const badYear = yearNum !== null && (!Number.isInteger(yearNum) || yearNum < 1880 || yearNum > 2100);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('titles').insert({
      household_id: householdId, kind, name: name.trim(), year: yearNum, seasons: seasons ?? [], status, created_by: myId,
    });
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast(`Added ${name.trim()}`); onSaved(status); }
  }

  return (
    <Sheet title="Add to Watch" onClose={onClose} onSubmit={() => void save()} busy={busy} submitLabel="Add"
      canSubmit={!!name.trim() && seasons !== null && !badYear}>
      <div className="segmented" role="group" aria-label="Type">
        <button type="button" aria-pressed={kind === 'show'} onClick={() => setKind('show')}>TV show</button>
        <button type="button" aria-pressed={kind === 'film'} onClick={() => setKind('film')}>Film</button>
      </div>
      <div className="field">
        <label htmlFor="w-name">Name</label>
        <input id="w-name" required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="w-year">Year (optional)</label>
          <input id="w-year" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label htmlFor="w-status">Status</label>
          <select id="w-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="want">Want to watch</option>
            <option value="watching">Watching now</option>
            <option value="done">Already finished</option>
          </select>
        </div>
      </div>
      {kind === 'show' && (
        <div className="field">
          <label htmlFor="w-seasons">Episodes in each season</label>
          <input id="w-seasons" placeholder="e.g. 10, 8, 10" value={seasonsText} onChange={(e) => setSeasonsText(e.target.value)} />
          <span className="hint">One number per season. You can add more seasons later.</span>
          {seasons === null && <span className="hint" style={{ color: 'var(--attention)' }}>Use numbers separated by commas.</span>}
        </div>
      )}
    </Sheet>
  );
}

function TitleSheet({ title, householdId, viewer, members, views, onClose, onChanged }: {
  title: Title; householdId: string; viewer: Viewer; members: Member[]; views: Viewing[]; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [seasonsText, setSeasonsText] = useState(title.seasons.join(', '));
  const [status, setStatus] = useState<Status>(title.status);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seasons = title.kind === 'show' ? parseSeasons(seasonsText) : [];
  const member_id = viewer === 'together' ? null : viewer;
  const viewerName = viewer === 'together' ? 'together' : members.find((m) => m.id === viewer)?.display_name ?? '';
  const watched = useMemo(() => new Set(views.filter((v) => v.title_id === title.id && viewerKey(v.member_id) === viewer).map((v) => `${v.season}-${v.episode}`)), [views, title.id, viewer]);

  async function toggle(s: number, e: number) {
    const existing = views.find((v) => v.title_id === title.id && viewerKey(v.member_id) === viewer && v.season === s && v.episode === e);
    const { error } = existing
      ? await supabase.from('viewings').delete().eq('id', existing.id)
      : await supabase.from('viewings').insert({ household_id: householdId, title_id: title.id, member_id, season: s, episode: e });
    if (error) toast(friendlyError(error), 'error');
    onChanged();
  }

  async function markSeason(s: number) {
    const rows = Array.from({ length: title.seasons[s - 1] }, (_, i) => ({ household_id: householdId, title_id: title.id, member_id, season: s, episode: i + 1 }));
    const { error } = await supabase.from('viewings').upsert(rows, { onConflict: 'title_id,member_id,season,episode', ignoreDuplicates: true });
    if (error) toast(friendlyError(error), 'error'); else toast(`Season ${s} marked watched (${viewerName})`);
    onChanged();
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('titles').update({ status, seasons: seasons ?? title.seasons }).eq('id', title.id);
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast('Saved'); onChanged(); onClose(); }
  }

  return (
    <>
      <Sheet title={title.name} onClose={onClose} onSubmit={() => void save()} busy={busy} canSubmit={seasons !== null}
        footer={<button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete</button>}>
        <div className="field">
          <label htmlFor="ts-status">Status</label>
          <select id="ts-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        {title.kind === 'show' && (
          <>
            <div className="field">
              <label htmlFor="ts-seasons">Episodes in each season</label>
              <input id="ts-seasons" value={seasonsText} onChange={(e) => setSeasonsText(e.target.value)} />
            </div>
            <p className="muted small">Tap an episode to mark or unmark it, watched <strong>{viewerName}</strong>. Change who at the top of Watch.</p>
            {title.seasons.map((count, si) => (
              <div key={si} className="season">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Season {si + 1}</strong>
                  <button type="button" className="btn btn-ghost" onClick={() => void markSeason(si + 1)}>Mark all watched</button>
                </div>
                <div className="ep-grid">
                  {Array.from({ length: count }, (_, ei) => {
                    const on = watched.has(`${si + 1}-${ei + 1}`);
                    return (
                      <button key={ei} type="button" className="ep-btn" aria-pressed={on} aria-label={`Season ${si + 1} episode ${ei + 1}${on ? ', watched' : ''}`}
                        onClick={() => void toggle(si + 1, ei + 1)}>{ei + 1}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </Sheet>
      {confirmDelete && (
        <ConfirmDialog danger title={`Delete ${title.name}?`} body="Its viewing history is deleted too." confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { error } = await supabase.from('titles').delete().eq('id', title.id);
            if (error) toast(friendlyError(error), 'error'); else { toast('Deleted'); onChanged(); onClose(); }
            setConfirmDelete(false);
          }} />
      )}
    </>
  );
}
