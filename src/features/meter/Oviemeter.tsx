import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Empty, LoadError, Spinner } from '../../components/States';
import { useToast } from '../../components/Toast';
import { useHousehold } from '../../app/HouseholdProvider';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/errors';
import { useLive } from '../../lib/live';
import { ago } from '../../lib/activity';
import {
  lookOf, METER_COLS, METER_MAX, roomFor, scoreOf, signed, standing, type MeterPoint,
} from '../../lib/meter';
import type { Member } from '../../lib/types';
import {
  canWish, isOpen, sortWishes, timeLeft, WISH_COLS, WISH_COST, WISH_DAYS, wishPointsFree, type Wish,
} from '../../lib/genie';
import { useHighlightOnArrival } from '../activity/Activity';
import { MeterGauge, MeterSheep } from './MeterArt';

/** Everyone's angel-or-devil dial. Give someone good or bad points (1–10 at a time), always saying why. */
export function OviemeterScreen() {
  const { household, members, me, thisDevice } = useHousehold();
  const toast = useToast();
  const hid = household?.id;
  const live = useLive<MeterPoint[]>('meter', hid, ['meter_points'], () =>
    supabase.from('meter_points').select(METER_COLS).eq('household_id', hid!).order('created_at', { ascending: false }).limit(300));
  const wishLive = useLive<Wish[]>('wishes', hid, ['wishes'], () =>
    supabase.from('wishes').select(WISH_COLS).eq('household_id', hid!).order('created_at', { ascending: false }).limit(100));
  const [giving, setGiving] = useState<{ to: Member; sign: 1 | -1 } | null>(null);
  const [removing, setRemoving] = useState<MeterPoint | null>(null);
  const [wishingFor, setWishingFor] = useState<Member | null>(null);
  const [granting, setGranting] = useState<Wish | null>(null);
  const [takingBack, setTakingBack] = useState<Wish | null>(null);
  const points = live.data ?? [];
  const wishes = wishLive.data ?? [];
  useHighlightOnArrival();
  const isWall = thisDevice?.kind === 'wall';
  const name = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? 'Someone';

  async function remove(p: MeterPoint) {
    live.setData((rows) => rows?.filter((r) => r.id !== p.id) ?? rows);
    const { error } = await supabase.from('meter_points').delete().eq('id', p.id);
    if (error) { toast(friendlyError(error), 'error'); void live.reload(); } else toast('Taken back');
  }

  async function grant(w: Wish) {
    wishLive.setData((rows) => rows?.map((r) => (r.id === w.id ? { ...r, granted_at: new Date().toISOString() } : r)) ?? rows);
    const { error } = await supabase.from('wishes').update({ granted_at: new Date().toISOString() }).eq('id', w.id);
    if (error) toast(friendlyError(error), 'error'); else toast(`Wish granted 🧞 ${name(w.from_member)} −${WISH_COST}`);
    void wishLive.reload(); void live.reload();
  }

  async function takeBack(w: Wish) {
    wishLive.setData((rows) => rows?.filter((r) => r.id !== w.id) ?? rows);
    const { error } = await supabase.from('wishes').delete().eq('id', w.id);
    if (error) { toast(friendlyError(error), 'error'); void wishLive.reload(); } else toast('Wish taken back');
  }

  return (
    <Screen title="Oviemeter" sheep="happy">
      <div className="module">
        {live.error ? <LoadError message={live.error} onRetry={() => void live.reload()} />
          : live.loading ? <Spinner /> : (
            <>
              <div className="meter-grid">
                {/* on a phone, the people you can score come first, so their +1 / −1 are on screen straight away */}
                {members.map((m, i) => ({ m, i })).sort((x, y) => Number(x.m.id === me?.id && !isWall) - Number(y.m.id === me?.id && !isWall)).map(({ m, i }) => {
                  const score = scoreOf(points, m.id);
                  const look = lookOf(household?.settings, m.id, i);
                  const st = standing(score);
                  const canScore = members.length > 1 && (isWall || (me && me.id !== m.id));
                  return (
                    <section key={m.id} className={`meter-card is-${st.kind}`} aria-label={`${m.display_name}'s Oviemeter`}>
                      <h2 className="meter-name">{m.display_name}</h2>
                      <MeterSheep score={score} look={look} />
                      <MeterGauge score={score} />
                      <p className="meter-score"><strong>{signed(score)}</strong> <span>{st.label}</span></p>
                      {!canScore && members.length > 1 && <p className="muted small">Only {members.filter((x) => x.id !== m.id).map((x) => x.display_name).join(' or ')} can change your score</p>}
                      {canScore && (
                        <div className="meter-actions">
                          <button type="button" className="btn meter-bad" disabled={roomFor(score, -1) === 0} aria-label={`Take a point off ${m.display_name}`}
                            onClick={() => setGiving({ to: m, sign: -1 })}>😈 −1</button>
                          <button type="button" className="btn meter-good" disabled={roomFor(score, 1) === 0} aria-label={`Give ${m.display_name} a point`}
                            onClick={() => setGiving({ to: m, sign: 1 })}>😇 +1</button>
                          <button type="button" className="btn meter-wish" aria-label={`Make a genie wish for ${m.display_name}`}
                            onClick={() => setWishingFor(m)}>🧞 Wish</button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>

              <WishList wishes={wishes} name={name} isWall={isWall} meId={me?.id ?? null}
                onGrant={setGranting} onTakeBack={setTakingBack} />

              <section>
                <h2 className="group-label">What happened</h2>
                {points.length === 0 ? (
                  <Empty title="Nobody's been scored yet" mood="thinking">Tap +1 or −1 under someone, say why, and save. Pick a bigger number for something really good or bad.</Empty>
                ) : (
                  <ul className="meter-log">
                    {points.map((p) => (
                      <li key={p.id} data-ref={p.id} className="row-item">
                        <span className={`meter-chip ${p.points > 0 ? 'is-good' : 'is-bad'}`}>{signed(p.points)}</span>
                        <span className="row-main meter-log-main">
                          <span className="row-title">{p.reason}</span>
                          <span className="row-meta">
                            {p.points > 0 ? '😇' : '😈'} {name(p.to_member)}
                            {p.from_member ? ` · from ${name(p.from_member)}` : ''} · {ago(p.created_at)}
                          </span>
                        </span>
                        {(isWall || (me && p.from_member === me.id)) && (
                          <button type="button" className="btn btn-ghost btn-icon" aria-label="Take these points back" onClick={() => setRemoving(p)}>
                            <Trash2 size={18} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
      </div>

      {giving && hid && (
        <GiveSheet householdId={hid} to={giving.to} sign={giving.sign} score={scoreOf(points, giving.to.id)}
          from={isWall ? null : me} members={members} onClose={() => setGiving(null)}
          onSaved={() => { setGiving(null); void live.reload(); }} />
      )}
      {wishingFor && hid && (
        <WishSheet householdId={hid} to={wishingFor} from={isWall ? null : me} members={members} points={points} wishes={wishes}
          onClose={() => setWishingFor(null)} onSaved={() => { setWishingFor(null); void wishLive.reload(); }} />
      )}
      {granting && (
        <ConfirmDialog title="Wish granted? 🧞" body={`“${granting.wish}”. ${name(granting.from_member)} pays ${WISH_COST} points from their Oviemeter.`}
          confirmLabel="Granted" onCancel={() => setGranting(null)}
          onConfirm={async () => { const w = granting; setGranting(null); await grant(w); }} />
      )}
      {takingBack && (
        <ConfirmDialog title="Take this wish back?" body={`“${takingBack.wish}”. Nobody gains or loses points.`}
          confirmLabel="Take back" onCancel={() => setTakingBack(null)}
          onConfirm={async () => { const w = takingBack; setTakingBack(null); await takeBack(w); }} />
      )}
      {removing && (
        <ConfirmDialog title="Take these points back?" body={`${signed(removing.points)} for ${name(removing.to_member)}: “${removing.reason}”`}
          confirmLabel="Take back" onCancel={() => setRemoving(null)}
          onConfirm={async () => { const p = removing; setRemoving(null); await remove(p); }} />
      )}
    </Screen>
  );
}

function GiveSheet({ householdId, to, sign, score, from, members, onClose, onSaved }: {
  householdId: string; to: Member; sign: 1 | -1; score: number; from: Member | null; members: Member[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const room = Math.min(METER_MAX, roomFor(score, sign));
  const [n, setN] = useState(1);
  const [reason, setReason] = useState('');
  const givers = members.filter((m) => m.id !== to.id);
  const [giver, setGiver] = useState<string | null>(from?.id ?? (givers.length === 1 ? givers[0].id : null));
  const [busy, setBusy] = useState(false);
  const good = sign > 0;

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('meter_points').insert({
      household_id: householdId, to_member: to.id, from_member: giver, points: sign * n, reason: reason.trim(),
    });
    setBusy(false);
    if (error) { toast(friendlyError(error), 'error'); return; }
    toast(good ? `${to.display_name} ${signed(n)} 😇` : `${to.display_name} ${signed(-n)} 😈`);
    onSaved();
  }

  return (
    <Sheet title={good ? `Plus points for ${to.display_name} 😇` : `Minus points for ${to.display_name} 😈`} onClose={onClose}
      onSubmit={() => void save()} busy={busy} canSubmit={room > 0 && !!reason.trim() && (!!from || !!giver)}
      submitLabel={good ? `Give ${signed(n)}` : `Take ${n} off`}>
      {room === 0 ? (
        <p className="muted">{to.display_name} is already at {signed(score)}, the end of the dial.</p>
      ) : (
        <div className="field">
          <span className="field-label">How many? {good ? '(more for something really good)' : '(more for something really bad)'}</span>
          <div className="meter-pick" role="radiogroup" aria-label="How many points">
            {Array.from({ length: room }, (_, i) => i + 1).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={n === v} className={`chip-btn plain ${good ? 'is-good' : 'is-bad'}`}
                onClick={() => setN(v)}>{good ? `+${v}` : `−${v}`}</button>
            ))}
          </div>
          {room < METER_MAX && <p className="muted small">{to.display_name} is on {signed(score)}, so {room} is as far as the dial goes.</p>}
        </div>
      )}
      <div className="field">
        <label htmlFor="meter-why">Why?</label>
        <textarea id="meter-why" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder={good ? 'e.g. Cooked an amazing dinner' : 'e.g. Ate the last Tim Tam'} />
      </div>
      {!from && (
        <div className="field">
          <span className="field-label">Who's giving them?</span>
          <div className="chips" role="radiogroup" aria-label="From">
            {givers.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={giver === m.id} className="chip-btn plain" onClick={() => setGiver(m.id)}>
                {m.display_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Genie wishes: waiting ones first with the time left, then the last few granted or missed. */
function WishList({ wishes, name, isWall, meId, onGrant, onTakeBack }: {
  wishes: Wish[]; name: (id: string | null) => string; isWall: boolean; meId: string | null;
  onGrant: (w: Wish) => void; onTakeBack: (w: Wish) => void;
}) {
  const list = sortWishes(wishes);
  const open = list.filter(isOpen);
  const shown = [...open, ...list.filter((w) => !isOpen(w)).slice(0, 5)];
  return (
    <section>
      <h2 className="group-label">🧞 Genie wishes</h2>
      {shown.length === 0 ? (
        <p className="muted small">
          Spend {WISH_COST} points on a wish: anything you like, written down. The other person has {WISH_DAYS} days to grant it.
          When they do, you pay the {WISH_COST} points; if they don't, they lose {WISH_COST}. Tap 🧞 Wish under their name.
        </p>
      ) : (
        <ul className="meter-log">
          {shown.map((w) => {
            const waiting = isOpen(w);
            const canGrant = waiting && (isWall || meId === w.to_member || meId === w.from_member);
            const canTakeBack = waiting && (isWall || meId === w.from_member);
            return (
              <li key={w.id} data-ref={w.id} className={`row-item wish-row${waiting ? ' is-waiting' : ''}`}>
                <span className="wish-lamp" aria-hidden="true">{w.granted_at ? '✅' : w.missed_at ? '❌' : '🧞'}</span>
                <span className="row-main meter-log-main">
                  <span className="row-title">“{w.wish}”</span>
                  <span className="row-meta">
                    {name(w.from_member)}’s wish for {name(w.to_member)} · {w.granted_at ? `granted · ${name(w.from_member)} paid ${WISH_COST}`
                      : w.missed_at ? `not granted in time · ${name(w.to_member)} lost ${WISH_COST}`
                      : <strong className={new Date(w.due_at).getTime() - Date.now() < 86_400_000 ? 'wish-soon' : ''}>{timeLeft(w.due_at)}</strong>}
                  </span>
                </span>
                {canGrant && (
                  <button type="button" className="btn btn-secondary wish-grant" onClick={() => onGrant(w)} aria-label={`Mark “${w.wish}” granted`}>
                    <Check size={18} /> Granted
                  </button>
                )}
                {canTakeBack && (
                  <button type="button" className="btn btn-ghost btn-icon" aria-label="Take this wish back" onClick={() => onTakeBack(w)}>
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WishSheet({ householdId, to, from, members, points, wishes, onClose, onSaved }: {
  householdId: string; to: Member; from: Member | null; members: Member[]; points: MeterPoint[]; wishes: Wish[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const wishers = members.filter((m) => m.id !== to.id);
  const [wisher, setWisher] = useState<string | null>(from?.id ?? (wishers.length === 1 ? wishers[0].id : null));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const who = members.find((m) => m.id === wisher) ?? null;
  const score = wisher ? scoreOf(points, wisher) : 0;
  const ok = !!wisher && canWish(score, wishes, wisher);
  const free = wisher ? wishPointsFree(score, wishes, wisher) : 0;
  const you = from ? 'you' : who?.display_name ?? 'they';

  async function save() {
    if (!wisher) return;
    setBusy(true);
    const { error } = await supabase.from('wishes').insert({ household_id: householdId, from_member: wisher, to_member: to.id, wish: text.trim() });
    setBusy(false);
    if (error) { toast(friendlyError(error), 'error'); return; }
    toast(`Wish made 🧞 ${to.display_name} has ${WISH_DAYS} days`);
    onSaved();
  }

  return (
    <Sheet title={`🧞 A wish for ${to.display_name}`} onClose={onClose} onSubmit={() => void save()} busy={busy}
      canSubmit={ok && !!text.trim()} submitLabel="Make the wish">
      <p className="muted">
        {to.display_name} has {WISH_DAYS} days to grant it. When they do, {you} pay{from ? '' : 's'} {WISH_COST} points.
        If they don't, {to.display_name} loses {WISH_COST}.
      </p>
      {!from && (
        <div className="field">
          <span className="field-label">Who's wishing?</span>
          <div className="chips" role="radiogroup" aria-label="Who's wishing">
            {wishers.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={wisher === m.id} className="chip-btn plain" onClick={() => setWisher(m.id)}>
                {m.display_name}
              </button>
            ))}
          </div>
        </div>
      )}
      {wisher && !ok && (
        <div className="notice">
          {from ? 'You need' : `${who?.display_name} needs`} {WISH_COST} points to spend on a wish
          {free !== score ? ` (on ${signed(score)}, with ${signed(score - free)} kept for wishes still waiting)` : ` (on ${signed(score)} now)`}.
          Earn some good points first 😇
        </div>
      )}
      <div className="field">
        <label htmlFor="wish-text">What do you wish for?</label>
        <textarea id="wish-text" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Breakfast in bed on Sunday" disabled={!ok} />
      </div>
    </Sheet>
  );
}
