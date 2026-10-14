-- Ovie: rewards on jobs, and hearts on notes.
-- * A job can carry Oviemeter points (1-10) and/or a written treat. When it's ticked off, the points go
--   to whoever ticked it (or who it's for, if ticked on the wall) as an Oviemeter entry; unticking takes them back.
-- * Anyone can heart a note (one heart per device); it shows in What's new.
-- Touches only the `ovie` schema (plus the realtime publication).

alter table ovie.tasks
  add column reward_points integer check (reward_points between 1 and 10),
  add column reward_text   text check (length(btrim(reward_text)) between 1 and 120);

alter table ovie.meter_points add column task_id uuid references ovie.tasks(id) on delete set null;
create index meter_points_task_idx on ovie.meter_points (task_id);

create or replace function ovie.complete_task(p_task_id uuid, p_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t ovie.tasks%rowtype;
  v_next date;
  v_today date;
  v_step interval;
  v_new uuid;
begin
  select * into t from ovie.tasks where id = p_task_id for update;
  if not found or not ovie.is_member(t.household_id) then
    raise exception 'task not found' using errcode = '42501';
  end if;
  if not ovie.member_in(t.household_id, p_by) then
    raise exception 'that person is not in this household' using errcode = '23503';
  end if;
  if t.completed_at is not null then
    return null; -- already done: retrying changes nothing
  end if;

  update ovie.tasks set completed_at = now(), completed_by = p_by where id = p_task_id;

  if t.repeat_unit is null then
    return null;
  end if;

  v_step := make_interval(
    days   => case when t.repeat_unit = 'day'   then t.repeat_every else 0 end,
    weeks  => case when t.repeat_unit = 'week'  then t.repeat_every else 0 end,
    months => case when t.repeat_unit = 'month' then t.repeat_every else 0 end);
  v_today := ovie.household_today(t.household_id);
  v_next := (t.due_on + v_step)::date;
  while v_next <= v_today loop          -- done late: skip ahead to the next future date
    v_next := (v_next + v_step)::date;
  end loop;

  insert into ovie.tasks (household_id, title, notes, assignee_id, priority, due_on,
                          repeat_every, repeat_unit, series_id, created_by, reward_points, reward_text)
  values (t.household_id, t.title, t.notes, t.assignee_id, t.priority, v_next,
          t.repeat_every, t.repeat_unit, t.series_id, t.created_by, t.reward_points, t.reward_text)
  on conflict (series_id, due_on) where series_id is not null do nothing
  returning id into v_new;

  return v_new;
end;
$$;

create or replace function ovie.task_reward()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to uuid;
begin
  if old.completed_at is null and new.completed_at is not null and new.reward_points is not null then
    v_to := coalesce(new.completed_by, new.assignee_id);
    if v_to is null then return null; end if;  -- nobody to give it to
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason, task_id)
    values (new.household_id, v_to, nullif(new.created_by, v_to), new.reward_points,
            left('Did the job: ' || new.title, 200), new.id);
  elsif old.completed_at is not null and new.completed_at is null then
    delete from ovie.meter_points where task_id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function ovie.task_reward() from public, anon, authenticated;
create trigger tasks_reward after update of completed_at on ovie.tasks for each row execute function ovie.task_reward();

create table ovie.note_likes (
  note_id       uuid not null references ovie.notes(id) on delete cascade,
  device_id     uuid not null references ovie.devices(id) on delete cascade,
  household_id  uuid not null references ovie.households(id) on delete cascade,
  member_id     uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (note_id, device_id)
);
create index note_likes_household_idx on ovie.note_likes (household_id);
create index note_likes_device_idx on ovie.note_likes (device_id);
create index note_likes_member_idx on ovie.note_likes (member_id);

alter table ovie.note_likes enable row level security;
create policy note_likes_select on ovie.note_likes for select to authenticated using (ovie.is_member(household_id));
create policy note_likes_insert on ovie.note_likes for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id)
  and exists (select 1 from ovie.devices d where d.id = device_id and d.household_id = note_likes.household_id and d.user_id = (select auth.uid()))
  and exists (select 1 from ovie.notes n where n.id = note_id and n.household_id = note_likes.household_id));
create policy note_likes_delete on ovie.note_likes for delete to authenticated using (
  exists (select 1 from ovie.devices d where d.id = device_id and d.user_id = (select auth.uid())));
grant select, insert, delete on ovie.note_likes to authenticated;

alter table ovie.activity drop constraint activity_action_check;
alter table ovie.activity add constraint activity_action_check
  check (action in ('added', 'changed', 'done', 'undone', 'deleted', 'liked'));

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
    v_info := jsonb_build_object('points', (j->>'points')::int, 'to_member', j->>'to_member', 'from_member', j->>'from_member',
                                 'task', j->>'task_id');

  elsif tg_table_name = 'note_likes' then
    if tg_op <> 'INSERT' then return null; end if;
    v_kind := 'note'; v_action := 'liked'; v_ref := (j->>'note_id')::uuid;
    select left(regexp_replace(coalesce(n.body, ''), '\s+', ' ', 'g'), 120),
           jsonb_build_object('note_from', n.from_member, 'picture', (n.image_path is not null or n.gif_url is not null))
      into v_title, v_info
      from ovie.notes n where n.id = v_ref;

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
create trigger note_likes_activity after insert on ovie.note_likes for each row execute function ovie.log_activity();

alter publication supabase_realtime add table ovie.note_likes;
