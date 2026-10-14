import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
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
  lookOf, METER_COLS, METER_MAX, roomFor, scoreOf, signed, standing, type MeterLook, type MeterPoint,
} from '../../lib/meter';
import type { Member } from '../../lib/types';
import { MeterGauge, MeterSheep } from './MeterArt';

/** Everyone's angel-or-devil dial. Give someone good or bad points (1–10 at a time), always saying why. */
export function OviemeterScreen() {
  const { household, members, me, thisDevice, refresh } = useHousehold();
  const toast = useToast();
  const hid = household?.id;
  const live = useLive<MeterPoint[]>('meter', hid, ['meter_points'], () =>
    supabase.from('meter_points').select(METER_COLS).eq('household_id', hid!).order('created_at', { ascending: false }).limit(300));
  const [giving, setGiving] = useState<{ to: Member; sign: 1 | -1 } | null>(null);
  const [removing, setRemoving] = useState<MeterPoint | null>(null);
  const points = live.data ?? [];
  const isWall = thisDevice?.kind === 'wall';
  const name = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? 'Someone';

  async function setLook(m: Member, look: MeterLook) {
    if (!household) return;
    const looks = { ...((household.settings?.meter_looks ?? {}) as Record<string, string>), [m.id]: look };
    const { error } = await supabase.from('households').update({ settings: { ...household.settings, meter_looks: looks } }).eq('id', household.id);
    if (error) toast(friendlyError(error), 'error'); else void refresh();
  }

  async function remove(p: MeterPoint) {
    live.setData((rows) => rows?.filter((r) => r.id !== p.id) ?? rows);
    const { error } = await supabase.from('meter_points').delete().eq('id', p.id);
    if (error) { toast(friendlyError(error), 'error'); void live.reload(); } else toast('Taken back');
  }

  return (
    <Screen title="Oviemeter" sheep="happy">
      <div className="module">
        {live.error ? <LoadError message={live.error} onRetry={() => void live.reload()} />
          : live.loading ? <Spinner /> : (
            <>
              <div className="meter-grid">
                {members.map((m, i) => {
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
                      {canScore && (
                        <div className="meter-actions">
                          <button type="button" className="btn meter-bad" disabled={roomFor(score, -1) === 0}
                            onClick={() => setGiving({ to: m, sign: -1 })}><Minus size={20} /> Bad</button>
                          <button type="button" className="btn meter-good" disabled={roomFor(score, 1) === 0}
                            onClick={() => setGiving({ to: m, sign: 1 })}><Plus size={20} /> Good</button>
                        </div>
                      )}
                      {!isWall && <div className="segmented meter-look" role="group" aria-label={`${m.display_name}'s sheep`}>
                        <button type="button" aria-pressed={look === 'boy'} onClick={() => void setLook(m, 'boy')}>Boy sheep</button>
                        <button type="button" aria-pressed={look === 'girl'} onClick={() => void setLook(m, 'girl')}>Girl sheep</button>
                      </div>}
                    </section>
                  );
                })}
              </div>

              <section>
                <h2 className="group-label">What happened</h2>
                {points.length === 0 ? (
                  <Empty title="Nobody's been scored yet" mood="thinking">Tap Good or Bad under someone to give them points, and say why.</Empty>
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
    <Sheet title={good ? `Good points for ${to.display_name} 😇` : `Bad points for ${to.display_name} 😈`} onClose={onClose}
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
