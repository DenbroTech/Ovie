-- Ovie: the Oviemeter. Each person has a score from -10 (devil) to +10 (angel); anyone gives someone else
-- points up or down (1-10 at a time) and must say why. The score is the running total, held between -10 and 10.
-- Each one shows in What's new. Touches only the `ovie` schema (plus the realtime publication).

create table ovie.meter_points (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  to_member     uuid not null references ovie.members(id) on delete cascade,
  from_member   uuid references ovie.members(id) on delete set null,
  points        integer not null check (points between -10 and 10 and points <> 0),
  reason        text not null check (length(btrim(reason)) between 1 and 200),
  created_at    timestamptz not null default now(),
  check (from_member is distinct from to_member)
);
create index meter_points_household_idx on ovie.meter_points (household_id, created_at);
create index meter_points_to_idx on ovie.meter_points (to_member);
create index meter_points_from_idx on ovie.meter_points (from_member);

alter table ovie.meter_points enable row level security;
create policy meter_points_select on ovie.meter_points for select to authenticated using (ovie.is_member(household_id));
create policy meter_points_insert on ovie.meter_points for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, to_member) and ovie.member_in(household_id, from_member));
create policy meter_points_delete on ovie.meter_points for delete to authenticated using (ovie.is_member(household_id));
grant select, insert, delete on ovie.meter_points to authenticated;

alter table ovie.activity drop constraint activity_kind_check;
alter table ovie.activity add constraint activity_kind_check
  check (kind in ('task', 'shopping', 'note', 'event', 'meal', 'title', 'viewing', 'photo', 'meter'));

create or replace function ovie.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j jsonb;
  o jsonb;
  v_kind text;
  v_action text;
  v_title text;
  v_info jsonb;
  v_hid uuid;
  v_ref uuid;
  v_dev record;
begin
  -- only changes made by a paired device (not maintenance)
  if (select auth.uid()) is null then return null; end if;

  j := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_hid := (j->>'household_id')::uuid;
  v_ref := (j->>'id')::uuid;

  if tg_table_name = 'tasks' then
    v_kind := 'task'; v_title := j->>'title';
    if tg_op = 'INSERT' then
      -- the next round of a repeating job, made when the last one was ticked off: not news
      if j->>'series_id' is not null and exists (
        select 1 from ovie.tasks t where t.series_id = (j->>'series_id')::uuid and t.id <> v_ref
          and t.completed_at > now() - interval '30 seconds') then return null; end if;
      v_action := 'added'; v_info := jsonb_build_object('due_on', j->>'due_on');
    elsif tg_op = 'DELETE' then v_action := 'deleted';
    elsif o->>'completed_at' is null and j->>'completed_at' is not null then v_action := 'done';
    elsif o->>'completed_at' is not null and j->>'completed_at' is null then v_action := 'undone';
    elsif (o->'title', o->'notes', o->'assignee_id', o->'due_on', o->'priority', o->'repeat_every', o->'repeat_unit')
       is distinct from (j->'title', j->'notes', j->'assignee_id', j->'due_on', j->'priority', j->'repeat_every', j->'repeat_unit')
      then v_action := 'changed';
    end if;

  elsif tg_table_name = 'shopping_items' then
    v_kind := 'shopping'; v_title := j->>'name'; v_info := jsonb_build_object('list_id', j->>'list_id');
    if tg_op = 'INSERT' then v_action := 'added';
    elsif tg_op = 'UPDATE' and o->>'checked_at' is null and j->>'checked_at' is not null and j->>'cleared_at' is null then v_action := 'done';
    elsif tg_op = 'UPDATE' and (o->'name', o->'qty', o->'note') is distinct from (j->'name', j->'qty', j->'note') then v_action := 'changed';
    end if;

  elsif tg_table_name = 'notes' then
    v_kind := 'note';
    v_title := left(regexp_replace(coalesce(j->>'body', ''), '\s+', ' ', 'g'), 120);
    v_info := jsonb_build_object('to_member', j->>'to_member',
      'picture', (j->>'image_path' is not null or j->>'gif_url' is not null), 'drawing', j->'doodle' is not null and j->'doodle' <> 'null'::jsonb);
    if tg_op = 'INSERT' then v_action := 'added';
    elsif tg_op = 'UPDATE' and o->>'done_at' is null and j->>'done_at' is not null then v_action := 'done';
    elsif tg_op = 'UPDATE' and (o->'body', o->'image_path', o->'gif_url', o->'doodle', o->'to_member')
       is distinct from (j->'body', j->'image_path', j->'gif_url', j->'doodle', j->'to_member') then v_action := 'changed';
    end if;

  elsif tg_table_name = 'events' then
    v_kind := case when j->>'meal_id' is not null then 'meal' else 'event' end;
    v_title := j->>'title';
    v_info := jsonb_build_object('starts_at', j->>'starts_at', 'all_day', (j->>'all_day')::boolean);
    if tg_op = 'INSERT' then v_action := 'added';
    elsif tg_op = 'DELETE' then v_action := 'deleted';
    elsif (o->'title', o->'starts_at', o->'ends_at', o->'all_day', o->'location', o->'notes', o->'member_id', o->'repeat')
       is distinct from (j->'title', j->'starts_at', j->'ends_at', j->'all_day', j->'location', j->'notes', j->'member_id', j->'repeat')
      then v_action := 'changed';
    end if;

  elsif tg_table_name = 'titles' then
    v_kind := 'title'; v_title := j->>'name'; v_info := jsonb_build_object('status', j->>'status', 'kind', j->>'kind');
    if tg_op = 'INSERT' then v_action := 'added';
    elsif tg_op = 'UPDATE' and o->>'status' is distinct from j->>'status' then v_action := 'changed';
    end if;

  elsif tg_table_name = 'viewings' then
    if tg_op <> 'INSERT' then return null; end if;
    v_kind := 'viewing'; v_action := 'done';
    v_ref := (j->>'title_id')::uuid;
    select t.name into v_title from ovie.titles t where t.id = v_ref;
    v_info := jsonb_build_object('season', j->'season', 'episode', j->'episode');

  elsif tg_table_name = 'meter_points' then
    if tg_op <> 'INSERT' then return null; end if;
    v_kind := 'meter'; v_action := 'added'; v_title := j->>'reason';
    v_info := jsonb_build_object('points', (j->>'points')::int, 'to_member', j->>'to_member', 'from_member', j->>'from_member');

  elsif tg_table_name = 'photos' then
    if tg_op <> 'INSERT' then return null; end if;
    v_kind := 'photo'; v_action := 'added'; v_title := coalesce(j->>'caption', '');
  end if;

  if v_action is null or v_hid is null then return null; end if;

  select d.id, d.member_id into v_dev from ovie.devices d
   where d.user_id = (select auth.uid()) and d.household_id = v_hid limit 1;

  -- the same person changing the same thing again within two minutes: one entry, not five
  if v_action = 'changed' then
    update ovie.activity a set created_at = now(), title = left(coalesce(v_title, ''), 200), info = v_info
     where a.household_id = v_hid and a.ref_id = v_ref and a.kind = v_kind and a.action in ('changed', 'added')
       and a.actor_user = (select auth.uid()) and a.created_at > now() - interval '2 minutes';
    if found then return null; end if;
  end if;

  insert into ovie.activity (household_id, actor_user, actor_member, actor_device, kind, action, ref_id, title, info)
  values (v_hid, (select auth.uid()), v_dev.member_id, v_dev.id, v_kind, v_action, v_ref, left(coalesce(v_title, ''), 200), v_info);

  if random() < 0.02 then
    delete from ovie.activity a where a.household_id = v_hid and a.created_at < now() - interval '60 days';
  end if;
  return null;
exception when others then
  return null; -- never let "What's new" get in the way of saving
end;
$$;

revoke all on function ovie.log_activity() from public, anon, authenticated;

create trigger meter_points_activity after insert on ovie.meter_points for each row execute function ovie.log_activity();

alter publication supabase_realtime add table ovie.meter_points;
