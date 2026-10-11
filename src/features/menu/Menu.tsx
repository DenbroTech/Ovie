import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { addDays, dayLabel, todayIso, toIso } from '../../lib/dates';
import { MEAL_EMOJIS, mealTitle, plannedByDay, type Meal, type PlannedMeal } from '../../lib/menu';

const DAYS_AHEAD = 14;

/** Saved meals ("Pizza night") you put on days. A planned meal is an all-day calendar event, so it shows everywhere. */
export function MenuScreen() {
  const { household, me } = useHousehold();
  const { online } = useConnection();
  const toast = useToast();
  const hid = household?.id;
  const today = todayIso(household?.timezone);
  const meals = useLive<Meal[]>('meals', hid, ['meals'], () =>
    supabase.from('meals').select('id,name,emoji,notes').eq('household_id', hid!).order('name'));
  const planned = useLive<PlannedMeal[]>('meal-plans', hid, ['events', 'meals'], () =>
    supabase.from('events').select('id,meal_id,starts_at,title').eq('household_id', hid!).not('meal_id', 'is', null)
      .gte('starts_at', new Date(`${addDays(today, -1)}T00:00`).toISOString()).order('starts_at'));
  const [adding, setAdding] = useState(false);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const byDay = plannedByDay(planned.data ?? []);
  const mealById = (id: string | null) => (meals.data ?? []).find((m) => m.id === id);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  /** Put a meal on a day (replacing whatever was planned), or clear the day with null. */
  async function plan(day: string, meal: Meal | null) {
    const existing = byDay[day];
    const result = !meal
      ? existing ? await supabase.from('events').delete().eq('id', existing.id) : { error: null }
      : existing
        ? await supabase.from('events').update({ meal_id: meal.id, title: mealTitle(meal) }).eq('id', existing.id)
        : await supabase.from('events').insert({
          household_id: hid, title: mealTitle(meal), starts_at: new Date(`${day}T00:00`).toISOString(),
          all_day: true, meal_id: meal.id, created_by: me?.id ?? null,
        });
    if (result.error) { toast(friendlyError(result.error), 'error'); return; }
    toast(meal ? `${mealTitle(meal)} · ${dayLabel(day, today)}` : `${dayLabel(day, today)} cleared`);
    void planned.reload();
  }

  const error = meals.error ?? planned.error;
  return (
    <Screen title="Menu" sheep="hungry" actions={
      <button type="button" className="btn btn-primary btn-icon" aria-label="New meal" disabled={!online} onClick={() => setAdding(true)}>
        <Plus size={26} />
      </button>
    }>
      <div className="module">
        {error ? <LoadError message={error} onRetry={() => { void meals.reload(); void planned.reload(); }} />
          : meals.loading ? <Spinner /> : (
            <>
              <section>
                <h2 className="group-label">This week</h2>
                <ul className="menu-week">
                  {week.map((day) => {
                    const p = byDay[day];
                    const meal = p ? mealById(p.meal_id) : undefined;
                    return (
                      <li key={day}>
                        <button type="button" className={`menu-day${p ? ' has-meal' : ''}`} disabled={!online} onClick={() => setOpenDay(day)}>
                          <span className="menu-day-name">{dayLabel(day, today)}</span>
                          <span className="menu-day-meal">{p ? (meal ? mealTitle(meal) : p.title) : <span className="muted">Nothing planned</span>}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section>
                <h2 className="group-label">Our meals</h2>
                {(meals.data ?? []).length === 0 ? (
                  <Empty title="No meals saved yet" mood="hungry">Tap + to save one you have often, like 🍕 Pizza night or 🌭 Hot dogs.</Empty>
                ) : (
                  <ul className="meal-grid">
                    {(meals.data ?? []).map((m) => (
                      <li key={m.id}>
                        <button type="button" className="meal-tile" onClick={() => setOpenMeal(m)}>
                          <span className="meal-emoji" aria-hidden="true">{m.emoji || '🍽️'}</span>
                          <span className="meal-name">{m.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
      </div>

      {adding && hid && (
        <MealSheet householdId={hid} myId={me?.id ?? null} meal={null} onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); void meals.reload(); }} />
      )}
      {openMeal && hid && (
        <MealSheet householdId={hid} myId={me?.id ?? null} meal={openMeal} onClose={() => setOpenMeal(null)}
          onSaved={() => { setOpenMeal(null); void meals.reload(); void planned.reload(); }}
          plannedDays={Object.entries(byDay).filter(([, p]) => p.meal_id === openMeal.id).map(([d]) => d)}
          days={Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))} today={today}
          onPlan={async (day) => { await plan(day, openMeal); setOpenMeal(null); }} />
      )}
      {openDay && (
        <Sheet title={`Dinner · ${dayLabel(openDay, today)}`} onClose={() => setOpenDay(null)}>
          {(meals.data ?? []).length === 0 ? (
            <p className="muted">Save a meal first: close this and tap +.</p>
          ) : (
            <div className="meal-pick">
              {(meals.data ?? []).map((m) => (
                <button key={m.id} type="button" className="chip-btn meal-pick-btn" aria-pressed={byDay[openDay]?.meal_id === m.id}
                  onClick={async () => { await plan(openDay, m); setOpenDay(null); }}>
                  <span aria-hidden="true">{m.emoji || '🍽️'}</span> {m.name}
                </button>
              ))}
            </div>
          )}
          {byDay[openDay] && (
            <button type="button" className="btn btn-secondary" onClick={async () => { await plan(openDay, null); setOpenDay(null); }}>
              <Trash2 size={18} /> Nothing planned
            </button>
          )}
        </Sheet>
      )}
    </Screen>
  );
}

function MealSheet({ householdId, myId, meal, onClose, onSaved, plannedDays = [], days = [], today = toIso(new Date()), onPlan }: {
  householdId: string; myId: string | null; meal: Meal | null; onClose: () => void; onSaved: () => void;
  plannedDays?: string[]; days?: string[]; today?: string; onPlan?: (day: string) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(meal?.name ?? '');
  const [emoji, setEmoji] = useState(meal?.emoji ?? '🍕');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy(true);
    const row = { name: name.trim(), emoji: emoji || null, notes: notes.trim() || null };
    const { error } = meal
      ? await supabase.from('meals').update(row).eq('id', meal.id)
      : await supabase.from('meals').insert({ ...row, household_id: householdId, created_by: myId });
    // keep the days it's planned for in step with a new name or emoji
    if (!error && meal) await supabase.from('events').update({ title: mealTitle(row) }).eq('meal_id', meal.id);
    setBusy(false);
    if (error) toast(friendlyError(error), 'error'); else { toast(meal ? 'Saved' : `Saved ${mealTitle(row)}`); onSaved(); }
  }

  return (
    <>
      <Sheet title={meal ? mealTitle(meal) : 'New meal'} onClose={onClose} onSubmit={() => void save()} busy={busy}
        canSubmit={name.trim().length > 0} submitLabel={meal ? 'Save' : 'Add'}
        footer={meal ? <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete</button> : undefined}>
        {meal && onPlan && (
          <div className="field">
            <span className="field-label">Have it on…</span>
            <div className="chips">
              {days.map((d) => (
                <button key={d} type="button" className="chip-btn plain" aria-pressed={plannedDays.includes(d)} disabled={busy}
                  onClick={() => void onPlan(d)}>{dayLabel(d, today)}</button>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="meal-name">Name</label>
          <input id="meal-name" value={name} maxLength={60} placeholder="e.g. Pizza night" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label">Picture</span>
          <div className="emoji-grid" role="radiogroup" aria-label="Picture">
            {MEAL_EMOJIS.map((e) => (
              <button key={e} type="button" role="radio" aria-checked={emoji === e} className="emoji-btn" onClick={() => setEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="meal-notes">Notes <span className="muted">(optional)</span></label>
          <textarea id="meal-notes" rows={2} maxLength={500} placeholder="e.g. Get dough from the shops" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Sheet>
      {confirmDelete && meal && (
        <ConfirmDialog danger title={`Delete ${meal.name}?`} body="It's also taken off any days it's planned for." confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const { error } = await supabase.from('meals').delete().eq('id', meal.id);
            if (error) toast(friendlyError(error), 'error'); else { toast('Deleted'); onSaved(); }
            setConfirmDelete(false);
          }} />
      )}
    </>
  );
}
