-- Ovie foundation: schema, households, members, helpers.
-- Touches ONLY the `ovie` schema (plus adding ovie tables to the realtime publication).

create schema if not exists ovie;

-- Only signed-in users may use the schema. anon gets nothing.
revoke all on schema ovie from public;
grant usage on schema ovie to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function ovie.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Short human-friendly invite code, e.g. "K7QF-3MZP" (no 0/O/1/I).
create or replace function ovie.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  b bytea := extensions.gen_random_bytes(8);
  i int;
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    if i = 3 then code := code || '-'; end if;
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Households and members
-- ---------------------------------------------------------------------------

create table ovie.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 80),
  timezone     text not null default 'Australia/Sydney'
                 check (length(timezone) between 1 and 64),
  invite_code  text not null unique default ovie.new_invite_code(),
  settings     jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(settings) = 'object'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table ovie.members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null check (length(btrim(display_name)) between 1 and 40),
  role          text not null default 'adult' check (role in ('owner', 'adult', 'device')),
  colour        text not null default 'sage'
                  check (colour in ('sage', 'clay', 'sky', 'plum', 'sand', 'slate')),
  prefs         jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

create index members_user_id_idx on ovie.members (user_id);

create trigger households_touch before update on ovie.households
  for each row execute function ovie.touch_updated_at();
create trigger members_touch before update on ovie.members
  for each row execute function ovie.touch_updated_at();

-- Is the signed-in user a member of this household? Used by every policy.
-- security definer so the members lookup itself is not subject to RLS (avoids recursion).
create or replace function ovie.is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from ovie.members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

-- The signed-in user's member id in a household (null if none).
create or replace function ovie.my_member_id(p_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from ovie.members m
  where m.household_id = p_household_id
    and m.user_id = (select auth.uid());
$$;

create or replace function ovie.is_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from ovie.members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table ovie.households enable row level security;
alter table ovie.members enable row level security;

create policy households_select on ovie.households
  for select to authenticated
  using (ovie.is_member(id));

create policy households_update on ovie.households
  for update to authenticated
  using (ovie.is_member(id))
  with check (ovie.is_member(id));

-- Households are created and joined only through the RPCs below (no insert/delete policy).

create policy members_select on ovie.members
  for select to authenticated
  using (ovie.is_member(household_id));

-- You can edit your own member row; an owner can edit anyone in the household.
create policy members_update on ovie.members
  for update to authenticated
  using (user_id = (select auth.uid()) or ovie.is_owner(household_id))
  with check (user_id = (select auth.uid()) or ovie.is_owner(household_id));

-- An owner can remove another member; nobody can remove themselves via the table.
create policy members_delete on ovie.members
  for delete to authenticated
  using (ovie.is_owner(household_id) and user_id is distinct from (select auth.uid()));

-- Column-level protection: role and household can only change via RPC/owner rules.
create or replace function ovie.members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id <> old.household_id or new.user_id is distinct from old.user_id then
    raise exception 'household_id and user_id cannot be changed' using errcode = '42501';
  end if;
  if new.role <> old.role and not ovie.is_owner(old.household_id) then
    raise exception 'only an owner can change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger members_guard before update on ovie.members
  for each row execute function ovie.members_guard();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a household; the caller becomes its owner. One household per login for now.
create or replace function ovie.create_household(
  p_name text,
  p_display_name text,
  p_timezone text default 'Australia/Sydney'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from ovie.members where user_id = v_uid) then
    raise exception 'this login already belongs to a household' using errcode = '23505';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'unknown timezone %', p_timezone using errcode = '22023';
  end if;

  insert into ovie.households (name, timezone)
  values (btrim(p_name), p_timezone)
  returning id into v_household;

  insert into ovie.members (household_id, user_id, display_name, role)
  values (v_household, v_uid, btrim(p_display_name), 'owner');

  return v_household;
end;
$$;

-- Join a household with its invite code. p_role: 'adult' for a person, 'device' for the kiosk.
create or replace function ovie.join_household(
  p_code text,
  p_display_name text,
  p_role text default 'adult'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_colour text;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_role not in ('adult', 'device') then
    raise exception 'role must be adult or device' using errcode = '22023';
  end if;
  if exists (select 1 from ovie.members where user_id = v_uid) then
    raise exception 'this login already belongs to a household' using errcode = '23505';
  end if;

  select id into v_household
  from ovie.households
  where invite_code = upper(btrim(p_code));

  if v_household is null then
    raise exception 'invite code not recognised' using errcode = 'P0002';
  end if;

  -- Give each new person a colour not yet used in the household.
  select c into v_colour
  from unnest(array['clay', 'sky', 'plum', 'sand', 'slate', 'sage']) with ordinality as t(c, n)
  where c not in (select colour from ovie.members where household_id = v_household)
  order by n
  limit 1;

  insert into ovie.members (household_id, user_id, display_name, role, colour)
  values (v_household, v_uid, btrim(p_display_name), p_role, coalesce(v_colour, 'slate'));

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
  if not ovie.is_owner(p_household_id) then
    raise exception 'only an owner can change the invite code' using errcode = '42501';
  end if;
  update ovie.households
     set invite_code = ovie.new_invite_code()
   where id = p_household_id
  returning invite_code into v_code;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (authenticated only; RLS does the real filtering)
-- ---------------------------------------------------------------------------

grant select, update on ovie.households to authenticated;
grant select, update, delete on ovie.members to authenticated;
grant all on all tables in schema ovie to service_role;

revoke execute on all functions in schema ovie from public, anon;
grant execute on function
  ovie.is_member(uuid),
  ovie.my_member_id(uuid),
  ovie.is_owner(uuid),
  ovie.create_household(text, text, text),
  ovie.join_household(text, text, text),
  ovie.regenerate_invite_code(uuid)
to authenticated;

-- Anything created later in ovie is also closed to anon by default.
alter default privileges in schema ovie revoke execute on functions from public;

-- Live sync between devices.
alter publication supabase_realtime add table ovie.households, ovie.members;
