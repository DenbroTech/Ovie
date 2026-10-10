import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Repeat, Star, Trash2, Undo2, Check } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { PersonPicker, WhoBadge } from '../../components/PersonPicker';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { useConnection } from '../../app/ConnectionProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';
import { dayLabel, repeatLabel, todayIso, type RepeatUnit } from '../../lib/dates';
import type { Member } from '../../lib/types';

export interface Task {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  assignee_id: string | null;
  priority: number;
  due_on: string | null;
  repeat_every: number | null;
  repeat_unit: RepeatUnit | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

const COLS = 'id,household_id,title,notes,assignee_id,priority,due_on,repeat_every,repeat_unit,completed_at,completed_by,created_at';

type View = 'todo' | 'done';
type Who = 'all' | string;

/** Open tasks in the order you'd do them: overdue, today, upcoming, then undated; important first within a day. */
export function sortOpen(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const da = a.due_on ?? '9999-12-31';
    const db = b.due_on ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.created_at < b.created_at ? -1 : 1;
  });
}

export function groupOpen(tasks: Task[], today: string): Array<{ label: string; tasks: Task[] }> {
  const groups: Record<string, Task[]> = { Overdue: [], Today: [], Upcoming: [], Anytime: [] };
  for (const t of sortOpen(tasks)) {
    if (!t.due_on) groups.Anytime.push(t);
    else if (t.due_on < today) groups.Overdue.push(t);
    else if (t.due_on === today) groups.Today.push(t);
    else groups.Upcoming.push(t);
  }
  return Object.entries(groups).filter(([, v]) => v.length > 0).map(([label, v]) => ({ label, tasks: v }));
}

export function TasksScreen() {
  const { household, members, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const [view, setView] = useState<View>('todo');
  const [who, setWho] = useState<Who>('all');
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hid = household?.id;
  const today = todayIso(household?.timezone);
  const live = useLive<Task[]>('tasks', hid, ['tasks'], () =>
    supabase.from('tasks').select(COLS).eq('household_id', hid!)
      .or(`completed_at.is.null,completed_at.gt.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`)
      .order('created_at'),
  );

  const tasks = live.data ?? [];
  const filtered = useMemo(
    () => tasks.filter((t) => who === 'all' || t.assignee_id === who || (who === 'shared' && !t.assignee_id)),
    [tasks, who],
  );
  const open = filtered.filter((t) => !t.completed_at);
  const done = filtered.filter((t) => t.completed_at).sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1));
  const memberById = (id: string | null) => members.find((m) => m.id === id) ?? null;

  async function addQuick(e: FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title || !hid) return;
    setQuick('');
    const { error } = await supabase.from('tasks').insert({
      household_id: hid, title, created_by: me?.id ?? null,
      assignee_id: who !== 'all' && who !== 'shared' ? who : null,
    });
    if (error) { toast(friendlyError(error), 'error'); setQuick(title); }
    else void live.reload();
  }

  async function complete(t: Task) {
    setBusyId(t.id);
    live.setData((rows) => rows?.map((r) => (r.id === t.id ? { ...r, completed_at: new Date().toISOString(), completed_by: me?.id ?? null } : r)) ?? rows);
    const { data: next, error } = await supabase.rpc('complete_task', { p_task_id: t.id, p_by: me?.id ?? null });
    setBusyId(null);
    if (error) { toast(friendlyError(error), 'error'); void live.reload(); return; }
    toast(next ? `Done. Next one is ${t.repeat_unit === 'day' && t.repeat_every === 1 ? 'tomorrow' : 'scheduled'}.` : 'Done');
    void live.reload();
  }

  async function undo(t: Task) {
    setBusyId(t.id);
    const { error } = await supabase.rpc('uncomplete_task', { p_task_id: t.id });
    setBusyId(null);
    if (error) toast(friendlyError(error), 'error');
    void live.reload();
  }

  return (
    <Screen title="Tasks" actions={
      <button type="button" className="btn btn-primary btn-icon" aria-label="New task" onClick={() => setEditing('new')} disabled={!online}>
        <Plus size={26} />
      </button>
    }>
      <div className="module">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" aria-pressed={view === 'todo'} onClick={() => setView('todo')}>To do{open.length ? ` (${open.length})` : ''}</button>
            <button type="button" aria-pressed={view === 'done'} onClick={() => setView('done')}>Done</button>
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 'var(--s-3)' }} role="group" aria-label="Whose tasks">
          <button type="button" className="chip-btn plain" aria-pressed={who === 'all'} onClick={() => setWho('all')}>Everyone's</button>
          {members.map((m) => (
            <button key={m.id} type="button" className="chip-btn plain" aria-pressed={who === m.id} onClick={() => setWho(m.id)}>
              {m.id === me?.id ? 'Mine' : m.display_name}
            </button>
          ))}
          <button type="button" className="chip-btn plain" aria-pressed={who === 'shared'} onClick={() => setWho('shared')}>Shared</button>
        </div>

        {view === 'todo' && (
          <form className="quick-add" onSubmit={addQuick} aria-label="Quick add task">
            <input aria-label="New task" placeholder="Add a task…" value={quick} maxLength={120}
              onChange={(e) => setQuick(e.target.value)} disabled={!online} />
            <button className="btn btn-primary" disabled={!online || !quick.trim()}>Add</button>
          </form>
        )}

        {live.error ? <LoadError message={live.error} onRetry={() => void live.reload()} />
          : live.loading ? <Spinner />
          : view === 'todo' ? (
            open.length === 0 ? <Empty title="Nothing to do!">Add a task above, or tap + for dates and repeats.</Empty> : (
              groupOpen(open, today).map((g) => (
                <section key={g.label}>
                  <h3 className="group-label">{g.label}</h3>
                  <ul className="list">
                    {g.tasks.map((t) => (
                      <TaskRow key={t.id} task={t} today={today} who={memberById(t.assignee_id)} busy={busyId === t.id || !online}
                        onTick={() => void complete(t)} onOpen={() => setEditing(t)} />
                    ))}
                  </ul>
                </section>
              ))
            )
          ) : (
            done.length === 0 ? <Empty title="Nothing finished yet">Ticked tasks from the last 30 days show here.</Empty> : (
              <ul className="list">
                {done.map((t) => (
                  <li key={t.id} className="row-item is-done">
                    <span className="tick" aria-hidden="true" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}><Check size={22} color="var(--accent-ink)" /></span>
                    <div className="row-main" style={{ cursor: 'default' }}>
                      <span className="row-title">{t.title}</span>
                      <span className="row-meta">
                        Done {dayLabel(t.completed_at!.slice(0, 10), today).toLowerCase()}
                        {memberById(t.completed_by) ? ` by ${memberById(t.completed_by)!.display_name}` : ''}
                      </span>
                    </div>
                    <button type="button" className="btn btn-secondary" disabled={busyId === t.id || !online} onClick={() => void undo(t)}>
                      <Undo2 size={18} /> Undo
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
      </div>

      {editing && hid && (
        <TaskSheet task={editing === 'new' ? null : editing} householdId={hid} today={today} myId={me?.id ?? null}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void live.reload(); }} />
      )}
    </Screen>
  );
}

function TaskRow({ task, today, who, busy, onTick, onOpen }: {
  task: Task; today: string; who: Member | null; busy: boolean; onTick: () => void; onOpen: () => void;
}) {
  const late = task.due_on !== null && task.due_on < today;
  const rep = repeatLabel(task.repeat_every, task.repeat_unit);
  return (
    <li className="row-item">
      <button type="button" className="tick" role="checkbox" aria-checked={false} aria-label={`Done: ${task.title}`} disabled={busy} onClick={onTick} />
      <button type="button" className="row-main" onClick={onOpen}>
        <span className="row-title">{task.priority === 1 && <Star size={16} className="star" fill="currentColor" aria-label="Important" />} {task.title}</span>
        {(task.due_on || rep) && (
          <span className="row-meta">
            {task.due_on && <span className={late ? 'late' : undefined}>{late ? `Overdue · ${dayLabel(task.due_on, today)}` : dayLabel(task.due_on, today)}</span>}
            {rep && <span><Repeat size={14} /> {rep}</span>}
          </span>
        )}
      </button>
      <WhoBadge member={who} />
    </li>
  );
}

const REPEATS: Array<{ label: string; every: number | null; unit: RepeatUnit | null }> = [
  { label: 'Never', every: null, unit: null },
  { label: 'Daily', every: 1, unit: 'day' },
  { label: 'Weekly', every: 1, unit: 'week' },
  { label: 'Fortnightly', every: 2, unit: 'week' },
  { label: 'Monthly', every: 1, unit: 'month' },
  { label: 'Every 3 months', every: 3, unit: 'month' },
];

function TaskSheet({ task, householdId, today, myId, onClose, onSaved }: {
  task: Task | null; householdId: string; today: string; myId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const { members } = useHousehold();
  const toast = useToast();
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [assignee, setAssignee] = useState<string | null>(task ? task.assignee_id : null);
  const [due, setDue] = useState(task?.due_on ?? '');
  const [important, setImportant] = useState(task?.priority === 1);
  const initialRepeat = REPEATS.findIndex((r) => r.every === (task?.repeat_every ?? null) && r.unit === (task?.repeat_unit ?? null));
  const [repeatIdx, setRepeatIdx] = useState(initialRepeat < 0 ? 0 : initialRepeat);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const repeat = REPEATS[repeatIdx];
  const needsDate = repeat.unit !== null && !due;

  async function save() {
    setBusy(true);
    const row = {
      title: title.trim(), notes: notes.trim() || null, assignee_id: assignee, due_on: due || null,
      priority: important ? 1 : 0, repeat_every: repeat.every, repeat_unit: repeat.unit,
    };
    const { error } = task
      ? await supabase.from('tasks').update(row).eq('id', task.id)
      : await supabase.from('tasks').insert({ ...row, household_id: householdId, created_by: myId });
    setBusy(false);
    if (error) toast(friendlyError(error), 'error');
    else { toast(task ? 'Saved' : 'Task added'); onSaved(); }
  }

  return (
    <>
      <Sheet title={task ? 'Edit task' : 'New task'} onClose={onClose} onSubmit={() => void save()} busy={busy}
        canSubmit={!!title.trim() && !needsDate} submitLabel={task ? 'Save' : 'Add task'}
        footer={task && (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} /> Delete
          </button>
        )}>
        <div className="field">
          <label htmlFor="t-title">What needs doing?</label>
          <input id="t-title" required maxLength={120} autoFocus={!task} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label">Who</span>
          <PersonPicker members={members} value={assignee} onChange={setAssignee} everyoneLabel="Anyone" label="Who" />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="t-due">Due</label>
            <input id="t-due" type="date" value={due} min={task ? undefined : today} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="t-repeat">Repeat</label>
            <select id="t-repeat" value={repeatIdx} onChange={(e) => setRepeatIdx(Number(e.target.value))}>
              {REPEATS.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
            </select>
          </div>
        </div>
        {needsDate && <div className="notice notice-warn">Pick a due date so Ovie knows when it starts repeating.</div>}
        <label className="check">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          <span>Important</span>
        </label>
        <div className="field">
          <label htmlFor="t-notes">Notes</label>
          <textarea id="t-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Sheet>
      {confirmDelete && task && (
        <ConfirmDialog danger title={`Delete "${task.title}"?`}
          body={task.repeat_unit ? 'Only this one is deleted. Future repeats that were already created stay.' : undefined}
          confirmLabel="Delete" onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { error } = await supabase.from('tasks').delete().eq('id', task.id);
            if (error) toast(friendlyError(error), 'error');
            else { toast('Deleted'); onSaved(); }
            setConfirmDelete(false);
          }} />
      )}
    </>
  );
}
