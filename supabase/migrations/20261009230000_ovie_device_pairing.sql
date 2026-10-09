-- Ovie: no logins. Each device signs in anonymously (Supabase anonymous sign-ins)
-- and is paired ONCE to the household with the invite code.
-- People (members) and devices are separate: a device may belong to a person or be a shared wall screen.
-- Closed system: only one household can ever be created; everyone else must join with its code.
-- Touches ONLY the `ovie` schema. Replaces the (empty) foundation tables.

drop function if exists ovie.create_household(text, text, text);
drop function if exists ovie.join_household(text, text, text);
drop function if exists ovie.regenerate_invite_code(uuid);
drop function if exists ovie.my_member_id(uuid);
drop table if exists ovie.members;
drop function if exists ovie.members_guard();
drop function if exists ovie.is_owner(uuid);
drop table if exists ovie.households;
drop function if exists ovie.is_member(uuid);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table ovie.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 80),
  timezone     text not null default 'Australia/Sydney' check (length(timezone) between 1 and 64),
  invite_code  text not null unique default ovie.new_invite_code(),
  settings     jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Closed system: at most one household, ever.
create unique index households_only_one on ovie.households ((true));

-- People in the household (who tasks are assigned to, who watched what).
create table ovie.members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  display_name  text not null check (length(btrim(display_name)) between 1 and 40),
  colour        text not null default 'sage'
                  check (colour in ('sage', 'clay', 'sky', 'plum', 'sand', 'slate')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index members_household_idx on ovie.members (household_id);

-- Paired devices. user_id is the device's anonymous Supabase user.
create table ovie.devices (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  member_id     uuid references ovie.members(id) on delete set null, -- null = shared
  kind          text not null default 'personal' check (kind in ('personal', 'wall')),
  label         text not null default 'Device' check (length(btrim(label)) between 1 and 40),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index devices_household_idx on ovie.devices (household_id);
create index devices_member_idx on ovie.devices (member_id);

create trigger households_touch before update on ovie.households
  for each row execute function ovie.touch_updated_at();
create trigger members_touch before update on ovie.members
  for each row execute function ovie.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is this device paired to the household? Used by every policy.
create or replace function ovie.is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from ovie.devices d
    where d.household_id = p_household_id
      and d.user_id = (select auth.uid())
  );
$$;

-- devices: household and user can never be changed by an update.
create or replace function ovie.devices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id <> old.household_id or new.user_id <> old.user_id then
    raise exception 'household_id and user_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger devices_guard before update on ovie.devices
  for each row execute function ovie.devices_guard();

-- members: household can never be moved.
create or replace function ovie.members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id <> old.household_id then
    raise exception 'household_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger members_guard before update on ovie.members
  for each row execute function ovie.members_guard();

-- A device's member must belong to the same household.
create or replace function ovie.devices_member_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_id is not null and not exists (
    select 1 from ovie.members m where m.id = new.member_id and m.household_id = new.household_id
  ) then
    raise exception 'that person is not in this household' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger devices_member_check before insert or update of member_id on ovie.devices
  for each row execute function ovie.devices_member_check();

-- ---------------------------------------------------------------------------
-- RLS: every policy requires a paired device of the household. No anon policies.
-- ---------------------------------------------------------------------------

alter table ovie.households enable row level security;
alter table ovie.members enable row level security;
alter table ovie.devices enable row level security;

create policy households_select on ovie.households for select to authenticated
  using (ovie.is_member(id));
create policy households_update on ovie.households for update to authenticated
  using (ovie.is_member(id)) with check (ovie.is_member(id));

create policy members_select on ovie.members for select to authenticated
  using (ovie.is_member(household_id));
create policy members_insert on ovie.members for insert to authenticated
  with check (ovie.is_member(household_id));
create policy members_update on ovie.members for update to authenticated
  using (ovie.is_member(household_id)) with check (ovie.is_member(household_id));
create policy members_delete on ovie.members for delete to authenticated
  using (ovie.is_member(household_id));

-- Devices are created only by the pairing RPCs. Any paired device can rename or unpair devices
-- (e.g. a lost phone) — including itself.
create policy devices_select on ovie.devices for select to authenticated
  using (ovie.is_member(household_id));
create policy devices_update on ovie.devices for update to authenticated
  using (ovie.is_member(household_id)) with check (ovie.is_member(household_id));
create policy devices_delete on ovie.devices for delete to authenticated
  using (ovie.is_member(household_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- What should a fresh device show? 'paired' | 'join' (a household exists) | 'setup' (first ever run).
create or replace function ovie.setup_state()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from ovie.devices where user_id = (select auth.uid())) then 'paired'
    when exists (select 1 from ovie.households) then 'join'
    else 'setup'
  end;
$$;

-- First run only: create THE household, the first person, and pair this device.
create or replace function ovie.setup_household(
  p_name text,
  p_person_name text,
  p_timezone text,
  p_kind text default 'personal'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from ovie.households) then
    raise exception 'Ovie is already set up — join with the invite code' using errcode = '23505';
  end if;
  if p_kind not in ('personal', 'wall') then
    raise exception 'kind must be personal or wall' using errcode = '22023';
  end if;
  perform now() at time zone p_timezone; -- raises 22023 for an unknown time zone

  insert into ovie.households (name, timezone) values (btrim(p_name), p_timezone)
  returning id into v_household;

  insert into ovie.members (household_id, display_name) values (v_household, btrim(p_person_name))
  returning id into v_member;

  insert into ovie.devices (household_id, user_id, member_id, kind, label)
  values (v_household, v_uid,
          case when p_kind = 'personal' then v_member end,
          p_kind,
          case when p_kind = 'wall' then 'Wall screen' else btrim(p_person_name) || '''s device' end);

  return v_household;
end;
$$;

-- Before pairing: who is in the household with this code? (Names and colours only.)
create or replace function ovie.people_for_code(p_code text)
returns table (id uuid, display_name text, colour text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.display_name, m.colour
  from ovie.members m
  join ovie.households h on h.id = m.household_id
  where h.invite_code = upper(btrim(p_code))
  order by m.created_at;
$$;

-- Pair this device. Choose an existing person (p_member_id), add a new one (p_new_person_name),
-- or neither for a shared wall screen (p_kind = 'wall').
create or replace function ovie.pair_device(
  p_code text,
  p_kind text default 'personal',
  p_member_id uuid default null,
  p_new_person_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_member uuid := p_member_id;
  v_colour text;
  v_label text;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_kind not in ('personal', 'wall') then
    raise exception 'kind must be personal or wall' using errcode = '22023';
  end if;
  if exists (select 1 from ovie.devices where user_id = v_uid) then
    raise exception 'this device is already paired' using errcode = '23505';
  end if;

  select id into v_household from ovie.households where invite_code = upper(btrim(p_code));
  if v_household is null then
    raise exception 'invite code not recognised' using errcode = 'P0002';
  end if;

  if p_kind = 'wall' then
    v_member := null;
    v_label := 'Wall screen';
  elsif nullif(btrim(coalesce(p_new_person_name, '')), '') is not null then
    select c into v_colour
    from unnest(array['clay', 'sky', 'plum', 'sand', 'slate', 'sage']) with ordinality as t(c, n)
    where c not in (select colour from ovie.members where household_id = v_household)
    order by n limit 1;
    insert into ovie.members (household_id, display_name, colour)
    values (v_household, btrim(p_new_person_name), coalesce(v_colour, 'slate'))
    returning id into v_member;
    v_label := btrim(p_new_person_name) || '''s device';
  elsif v_member is not null then
    select display_name || '''s device' into v_label
    from ovie.members where id = v_member and household_id = v_household;
    if v_label is null then
      raise exception 'that person is not in this household' using errcode = '23503';
    end if;
  else
    raise exception 'choose who this device is for' using errcode = '22023';
  end if;

  insert into ovie.devices (household_id, user_id, member_id, kind, label)
  values (v_household, v_uid, v_member, p_kind, v_label);

  return v_household;
end;
$$;

create or replace function ovie.regenerate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not ovie.is_member(p_household_id) then
    raise exception 'not paired to this household' using errcode = '42501';
  end if;
  update ovie.households set invite_code = ovie.new_invite_code()
   where id = p_household_id
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- Called when the app opens, so Settings can show when each device was last used.
create or replace function ovie.touch_device()
returns void
language sql
security definer
set search_path = ''
as $$
  update ovie.devices set last_seen_at = now()
  where user_id = (select auth.uid()) and last_seen_at < now() - interval '5 minutes';
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated (= any signed-in device) only; RLS does the filtering.
-- ---------------------------------------------------------------------------

grant select, update on ovie.households to authenticated;
grant select, insert, update, delete on ovie.members to authenticated;
grant select, delete on ovie.devices to authenticated;
grant update (member_id, label, kind) on ovie.devices to authenticated;
grant all on all tables in schema ovie to service_role;

revoke execute on all functions in schema ovie from public, anon;
grant execute on function
  ovie.is_member(uuid),
  ovie.setup_state(),
  ovie.setup_household(text, text, text, text),
  ovie.people_for_code(text),
  ovie.pair_device(text, text, uuid, text),
  ovie.regenerate_invite_code(uuid),
  ovie.touch_device()
to authenticated;

alter publication supabase_realtime add table ovie.households, ovie.members, ovie.devices;
