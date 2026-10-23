-- Ovie: the Oviemeter genie. Someone makes a wish (anything, in writing) that another person has to grant within
-- 3 days. When it's granted, the wisher pays 3 Oviemeter points; if 3 days pass without it, the other person
-- loses 3 instead (checked every 10 minutes by pg_cron). Granted is final. Each step shows in What's new.
-- Applied live as ovie_genie, ovie_genie_activity_kinds, ovie_genie_note_settle, ovie_genie_points, ovie_genie_clock.
-- Touches only the `ovie` schema (plus the realtime publication and one cron job).

create table ovie.wishes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  from_member   uuid not null references ovie.members(id) on delete cascade,
  to_member     uuid not null references ovie.members(id) on delete cascade,
  wish          text not null check (length(btrim(wish)) between 1 and 300),
  created_at    timestamptz not null default now(),
  due_at        timestamptz not null default now() + interval '3 days',
  granted_at    timestamptz,
  missed_at     timestamptz,
  check (from_member <> to_member),
  check (granted_at is null or missed_at is null)
);
create index wishes_household_idx on ovie.wishes (household_id, created_at);
create index wishes_from_idx on ovie.wishes (from_member);
create index wishes_to_idx on ovie.wishes (to_member);
create index wishes_open_idx on ovie.wishes (due_at) where granted_at is null and missed_at is null;

alter table ovie.meter_points add column wish_id uuid references ovie.wishes(id) on delete cascade;
create index meter_points_wish_idx on ovie.meter_points (wish_id);

alter table ovie.wishes enable row level security;
create policy wishes_select on ovie.wishes for select to authenticated using (ovie.is_member(household_id));
create policy wishes_insert on ovie.wishes for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, from_member) and ovie.member_in(household_id, to_member)
  and granted_at is null and missed_at is null
  and due_at between now() + interval '3 days' - interval '1 minute' and now() + interval '3 days' + interval '1 minute');
-- granting is the only change, once; a missed wish stays missed
create policy wishes_update on ovie.wishes for update to authenticated
  using (ovie.is_member(household_id) and granted_at is null and missed_at is null)
  with check (ovie.is_member(household_id) and missed_at is null);
-- a wish can be taken back before it's granted or missed
create policy wishes_delete on ovie.wishes for delete to authenticated
  using (ovie.is_member(household_id) and granted_at is null and missed_at is null);
grant select, insert, delete on ovie.wishes to authenticated;
grant update (granted_at) on ovie.wishes to authenticated;

alter table ovie.activity drop constraint activity_kind_check;
alter table ovie.activity add constraint activity_kind_check
  check (kind in ('task', 'shopping', 'note', 'event', 'meal', 'title', 'viewing', 'photo', 'meter', 'wish'));
alter table ovie.activity drop constraint activity_action_check;
alter table ovie.activity add constraint activity_action_check
  check (action in ('added', 'changed', 'done', 'undone', 'deleted', 'liked', 'missed'));

-- What's new line for a wish (made by a person, or by the clock when missed)
create or replace function ovie.wish_note(w ovie.wishes, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_dev record;
begin
  if (select auth.uid()) is not null then
    select d.id, d.member_id into v_dev from ovie.devices d
     where d.user_id = (select auth.uid()) and d.household_id = w.household_id limit 1;
  end if;
  insert into ovie.activity (household_id, actor_user, actor_member, actor_device, kind, action, ref_id, title, info)
  values (w.household_id, (select auth.uid()), v_dev.member_id, v_dev.id, 'wish', p_action, w.id, left(w.wish, 200),
          jsonb_build_object('from_member', w.from_member, 'to_member', w.to_member, 'due_at', w.due_at));
exception when others then null; -- never let What's new get in the way
end;
$$;
revoke all on function ovie.wish_note(ovie.wishes, text) from public, anon, authenticated;

-- The points row for a grant is written without the person's sign-in, so the general What's new trigger
-- (ovie.log_activity) skips it: the wish's own line says it.
create or replace function ovie.wish_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_claims text := current_setting('request.jwt.claims', true);
begin
  if tg_op = 'INSERT' then
    perform ovie.wish_note(new, 'added');
  elsif old.granted_at is null and new.granted_at is not null then
    -- granted: the wisher pays 3 points
    perform set_config('request.jwt.claims', '', true);
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason, wish_id)
    values (new.household_id, new.from_member, new.to_member, -3, left('Genie wish granted: ' || new.wish, 200), new.id);
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform ovie.wish_note(new, 'done');
  elsif old.missed_at is null and new.missed_at is not null then
    -- 3 days and not granted: the other person loses 3 (run by the clock, so no What's new line from the points)
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason, wish_id, created_at)
    values (new.household_id, new.to_member, new.from_member, -3, left('Genie wish not granted in 3 days: ' || new.wish, 200),
            new.id, new.due_at);
    perform ovie.wish_note(new, 'missed');
  end if;
  return null;
end;
$$;
revoke all on function ovie.wish_points() from public, anon, authenticated;
create trigger wishes_points after insert or update of granted_at, missed_at on ovie.wishes
  for each row execute function ovie.wish_points();

-- run by pg_cron: wishes whose 3 days are up
create or replace function ovie.settle_wishes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  update ovie.wishes set missed_at = now()
   where granted_at is null and missed_at is null and due_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function ovie.settle_wishes() from public, anon, authenticated;

select cron.schedule('ovie-settle-wishes', '*/10 * * * *', 'select ovie.settle_wishes()');

alter publication supabase_realtime add table ovie.wishes;
