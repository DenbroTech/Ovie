-- Ovie core modules: tasks (with repeats), shopping lists, calendar, watch tracker,
-- and read-only finance functions over ₲ryd's house tables.
-- Touches ONLY the `ovie` schema. ₲ryd's public.house_tx / public.house_people are only READ,
-- inside security-definer functions that require a paired device.

-- ---------------------------------------------------------------------------
-- Helper: is this person part of this household? (used in policies)
-- ---------------------------------------------------------------------------
create or replace function ovie.member_in(p_household_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_member_id is null or exists (
    select 1 from ovie.members m where m.id = p_member_id and m.household_id = p_household_id
  );
$$;

-- Today's date in the household's own time zone.
create or replace function ovie.household_today(p_household_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone h.timezone)::date from ovie.households h where h.id = p_household_id;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table ovie.tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 120),
  notes         text check (length(notes) <= 1000),
  assignee_id   uuid references ovie.members(id) on delete set null, -- null = anyone / shared
  priority      smallint not null default 0 check (priority in (0, 1)), -- 1 = important
  due_on        date,
  repeat_every  smallint check (repeat_every between 1 and 365),
  repeat_unit   text check (repeat_unit in ('day', 'week', 'month')),
  series_id     uuid,
  completed_at  timestamptz,
  completed_by  uuid references ovie.members(id) on delete set null,
  created_by    uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((repeat_every is null) = (repeat_unit is null)),
  check (repeat_unit is null or due_on is not null)
);
create index tasks_household_idx on ovie.tasks (household_id, completed_at);
-- One occurrence per series per date: completing twice can never create two "next" tasks.
create unique index tasks_series_due_uq on ovie.tasks (series_id, due_on) where series_id is not null;

create or replace function ovie.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.household_id <> old.household_id then
    raise exception 'household_id cannot be changed' using errcode = '42501';
  end if;
  if new.repeat_unit is not null and new.series_id is null then
    new.series_id := new.id;
  end if;
  if new.repeat_unit is null then
    new.series_id := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger tasks_before_write before insert or update on ovie.tasks
  for each row execute function ovie.tasks_before_write();

-- Complete a task. For a repeating task, also create the next occurrence (once, ever).
-- Returns the id of the next occurrence, or null.
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
                          repeat_every, repeat_unit, series_id, created_by)
  values (t.household_id, t.title, t.notes, t.assignee_id, t.priority, v_next,
          t.repeat_every, t.repeat_unit, t.series_id, t.created_by)
  on conflict (series_id, due_on) where series_id is not null do nothing
  returning id into v_new;

  return v_new;
end;
$$;

-- Undo a completion. The next occurrence (if any) stays; completing again won't duplicate it.
create or replace function ovie.uncomplete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from ovie.tasks where id = p_task_id;
  if v_household is null or not ovie.is_member(v_household) then
    raise exception 'task not found' using errcode = '42501';
  end if;
  update ovie.tasks set completed_at = null, completed_by = null where id = p_task_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shopping
-- ---------------------------------------------------------------------------
create table ovie.shopping_lists (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 40),
  sort          smallint not null default 0,
  created_at    timestamptz not null default now()
);
create index shopping_lists_household_idx on ovie.shopping_lists (household_id);

create table ovie.shopping_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  list_id       uuid not null references ovie.shopping_lists(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 80),
  qty           text check (length(qty) <= 20),
  note          text check (length(note) <= 200),
  checked_at    timestamptz,
  checked_by    uuid references ovie.members(id) on delete set null,
  cleared_at    timestamptz, -- "clear ticked" hides it but keeps it for "buy again"
  added_by      uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index shopping_items_list_idx on ovie.shopping_items (list_id, cleared_at);
create index shopping_items_household_idx on ovie.shopping_items (household_id, created_at desc);

create or replace function ovie.shopping_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from ovie.shopping_lists l where l.id = new.list_id and l.household_id = new.household_id) then
    raise exception 'that list is not in this household' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and new.household_id <> old.household_id then
    raise exception 'household_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger shopping_items_guard before insert or update on ovie.shopping_items
  for each row execute function ovie.shopping_items_guard();

-- Every household starts with these lists.
create or replace function ovie.households_default_lists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ovie.shopping_lists (household_id, name, sort)
  values (new.id, 'Groceries', 0), (new.id, 'Household', 1), (new.id, 'Hardware', 2);
  return new;
end;
$$;
create trigger households_default_lists after insert on ovie.households
  for each row execute function ovie.households_default_lists();

insert into ovie.shopping_lists (household_id, name, sort)
select h.id, l.name, l.sort
from ovie.households h
cross join (values ('Groceries', 0), ('Household', 1), ('Hardware', 2)) as l(name, sort)
where not exists (select 1 from ovie.shopping_lists s where s.household_id = h.id);

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------
create table ovie.events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 120),
  notes         text check (length(notes) <= 1000),
  location      text check (length(location) <= 120),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  member_id     uuid references ovie.members(id) on delete set null, -- null = everyone
  repeat        text not null default 'none' check (repeat in ('none', 'weekly', 'monthly', 'yearly')),
  created_by    uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_household_idx on ovie.events (household_id, starts_at);
create trigger events_touch before update on ovie.events
  for each row execute function ovie.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Watch: shows and films, progress per person or "together"
-- ---------------------------------------------------------------------------
create table ovie.titles (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  kind          text not null check (kind in ('show', 'film')),
  name          text not null check (length(btrim(name)) between 1 and 120),
  year          smallint check (year between 1880 and 2100),
  status        text not null default 'want' check (status in ('want', 'watching', 'paused', 'done', 'dropped')),
  seasons       smallint[] not null default '{}', -- episode count per season, e.g. {10,8}
  rating        smallint check (rating between 1 and 5),
  notes         text check (length(notes) <= 1000),
  created_by    uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (kind = 'show' or cardinality(seasons) = 0),
  check (cardinality(seasons) <= 60),
  check (0 < all (seasons) or cardinality(seasons) = 0),
  check (500 >= all (seasons) or cardinality(seasons) = 0)
);
create index titles_household_idx on ovie.titles (household_id, status);
create trigger titles_touch before update on ovie.titles
  for each row execute function ovie.touch_updated_at();

-- One row per watched episode (or per film: season 0, episode 0).
-- member_id null = watched together; individual and together progress never mix.
create table ovie.viewings (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  title_id      uuid not null references ovie.titles(id) on delete cascade,
  member_id     uuid references ovie.members(id) on delete cascade,
  season        smallint not null default 0 check (season between 0 and 60),
  episode       smallint not null default 0 check (episode between 0 and 500),
  watched_on    date not null default current_date,
  created_at    timestamptz not null default now(),
  unique nulls not distinct (title_id, member_id, season, episode)
);
create index viewings_title_idx on ovie.viewings (title_id);

create or replace function ovie.viewings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from ovie.titles t where t.id = new.title_id and t.household_id = new.household_id) then
    raise exception 'that title is not in this household' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger viewings_guard before insert or update on ovie.viewings
  for each row execute function ovie.viewings_guard();

-- ---------------------------------------------------------------------------
-- RLS: paired devices of the household only; people referenced must be in the same household.
-- ---------------------------------------------------------------------------
alter table ovie.tasks enable row level security;
alter table ovie.shopping_lists enable row level security;
alter table ovie.shopping_items enable row level security;
alter table ovie.events enable row level security;
alter table ovie.titles enable row level security;
alter table ovie.viewings enable row level security;

create policy tasks_select on ovie.tasks for select to authenticated using (ovie.is_member(household_id));
create policy tasks_insert on ovie.tasks for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, assignee_id)
  and ovie.member_in(household_id, created_by) and ovie.member_in(household_id, completed_by));
create policy tasks_update on ovie.tasks for update to authenticated using (ovie.is_member(household_id)) with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, assignee_id) and ovie.member_in(household_id, completed_by));
create policy tasks_delete on ovie.tasks for delete to authenticated using (ovie.is_member(household_id));

create policy lists_select on ovie.shopping_lists for select to authenticated using (ovie.is_member(household_id));
create policy lists_insert on ovie.shopping_lists for insert to authenticated with check (ovie.is_member(household_id));
create policy lists_update on ovie.shopping_lists for update to authenticated using (ovie.is_member(household_id)) with check (ovie.is_member(household_id));

create policy items_select on ovie.shopping_items for select to authenticated using (ovie.is_member(household_id));
create policy items_insert on ovie.shopping_items for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, added_by) and ovie.member_in(household_id, checked_by));
create policy items_update on ovie.shopping_items for update to authenticated using (ovie.is_member(household_id)) with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, checked_by));
create policy items_delete on ovie.shopping_items for delete to authenticated using (ovie.is_member(household_id));

create policy events_select on ovie.events for select to authenticated using (ovie.is_member(household_id));
create policy events_insert on ovie.events for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id) and ovie.member_in(household_id, created_by));
create policy events_update on ovie.events for update to authenticated using (ovie.is_member(household_id)) with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id));
create policy events_delete on ovie.events for delete to authenticated using (ovie.is_member(household_id));

create policy titles_select on ovie.titles for select to authenticated using (ovie.is_member(household_id));
create policy titles_insert on ovie.titles for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, created_by));
create policy titles_update on ovie.titles for update to authenticated using (ovie.is_member(household_id)) with check (ovie.is_member(household_id));
create policy titles_delete on ovie.titles for delete to authenticated using (ovie.is_member(household_id));

create policy viewings_select on ovie.viewings for select to authenticated using (ovie.is_member(household_id));
create policy viewings_insert on ovie.viewings for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id));
create policy viewings_delete on ovie.viewings for delete to authenticated using (ovie.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Finances: READ-ONLY view of ₲ryd's house money. Only paired devices may call it.
-- If ₲ryd's tables change shape, this raises an error and Ovie shows it honestly.
-- ---------------------------------------------------------------------------
create or replace function ovie.casa_summary(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
begin
  if not exists (select 1 from ovie.devices where user_id = (select auth.uid())) then
    raise exception 'not paired' using errcode = '42501';
  end if;
  v_start := date_trunc('month', coalesce(p_month, current_date))::date;
  v_end := (v_start + interval '1 month')::date;

  return jsonb_build_object(
    'month', v_start,
    'spent', (
      select coalesce(-sum(t.amount), 0) from public.house_tx t
      where t.direction = 'OUT' and not coalesce(t.excluded, false)
        and t.tx_date >= v_start and t.tx_date < v_end),
    'by_group', (
      select coalesce(jsonb_agg(jsonb_build_object('group', s.grp, 'total', s.total) order by s.total desc), '[]'::jsonb)
      from (select t.grp, -sum(t.amount) as total from public.house_tx t
            where t.direction = 'OUT' and not coalesce(t.excluded, false)
              and t.tx_date >= v_start and t.tx_date < v_end
            group by t.grp) s),
    'paid_in', (
      select coalesce(jsonb_agg(jsonb_build_object('group', s.grp, 'total', s.total) order by s.total desc), '[]'::jsonb)
      from (select t.grp, sum(t.amount) as total from public.house_tx t
            where t.direction = 'IN' and not coalesce(t.excluded, false)
              and t.tx_date >= v_start and t.tx_date < v_end
            group by t.grp) s),
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'share', p.share) order by p.sort_order), '[]'::jsonb)
      from public.house_people p),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', r.tx_date, 'amount', r.amount, 'group', r.grp,
               'direction', r.direction, 'merchant', r.merchant)), '[]'::jsonb)
      from (select t.tx_date, t.amount, t.grp, t.direction, t.merchant from public.house_tx t
            where not coalesce(t.excluded, false)
            order by t.tx_date desc, t.created_at desc limit 15) r)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants and realtime
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on ovie.tasks, ovie.shopping_items, ovie.events, ovie.titles to authenticated;
grant select, insert, update on ovie.shopping_lists to authenticated;
grant select, insert, delete on ovie.viewings to authenticated;
grant all on all tables in schema ovie to service_role;

revoke execute on all functions in schema ovie from public, anon;
grant execute on function
  ovie.is_member(uuid),
  ovie.member_in(uuid, uuid),
  ovie.household_today(uuid),
  ovie.setup_state(),
  ovie.setup_household(text, text, text, text),
  ovie.people_for_code(text),
  ovie.pair_device(text, text, uuid, text),
  ovie.regenerate_invite_code(uuid),
  ovie.touch_device(),
  ovie.complete_task(uuid, uuid),
  ovie.uncomplete_task(uuid),
  ovie.casa_summary(date)
to authenticated;

alter publication supabase_realtime add table
  ovie.tasks, ovie.shopping_lists, ovie.shopping_items, ovie.events, ovie.titles, ovie.viewings;
