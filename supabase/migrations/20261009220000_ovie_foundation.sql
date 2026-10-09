-- Ovie foundation: schema, households, members, invites, settings.
--
-- Scope rule: this migration creates and alters objects in the `ovie` schema
-- only. It references auth.users (foreign key) and calls auth.uid(), but it
-- never alters anything in `auth`, `public` or any other schema.
--
-- Access model:
--   * anon gets nothing in `ovie` (no usage on the schema, no grants).
--   * authenticated gets table privileges, and RLS limits every row to
--     households the caller belongs to.
--   * Multi-row writes (creating a household, accepting an invite) go through
--     security definer RPCs so they run atomically.

create schema if not exists ovie;

revoke all on schema ovie from public;
revoke all on schema ovie from anon;
grant usage on schema ovie to authenticated, service_role;

-- New tables/functions in ovie never get implicit anon/public grants.
alter default privileges in schema ovie revoke all on tables from public, anon;
alter default privileges in schema ovie revoke all on functions from public, anon;
alter default privileges in schema ovie revoke all on sequences from public, anon;
alter default privileges in schema ovie grant all on tables to service_role;
alter default privileges in schema ovie grant all on sequences to service_role;

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

-- ---------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------

create table ovie.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  -- IANA zone used for "today", recurrence and due dates.
  timezone    text not null default 'Australia/Sydney'
              check (char_length(timezone) between 1 and 64),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger households_touch
  before update on ovie.households
  for each row execute function ovie.touch_updated_at();

-- owner:  manages the household, members and invites.
-- member: a person in the household; full use of household data.
-- device: a shared screen (the kiosk). Uses household data but cannot manage
--         membership or household settings.
create table ovie.household_members (
  household_id  uuid not null references ovie.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null check (role in ('owner', 'member', 'device')),
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 40),
  -- A palette token name ("sage", "clay", ...) rather than a raw colour, so
  -- both themes can render it with good contrast.
  colour        text not null default 'sage'
                check (colour in ('sage', 'clay', 'sky', 'plum', 'ochre', 'slate')),
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on ovie.household_members (user_id);

-- Security definer so RLS policies can call them without recursing into
-- household_members' own policies. They only ever answer about auth.uid().
create or replace function ovie.is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from ovie.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function ovie.has_role(p_household_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from ovie.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Invites: an owner creates a short code; another signed-in user redeems it.
-- ---------------------------------------------------------------------------

create table ovie.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households (id) on delete cascade,
  code          text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  role          text not null default 'member' check (role in ('member', 'device')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '7 days',
  used_at       timestamptz,
  used_by       uuid references auth.users (id) on delete set null
);

create index household_invites_household_idx on ovie.household_invites (household_id);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

-- One row per household. `prefs` holds small UI preferences validated by the
-- app; anything relational gets its own table instead.
create table ovie.household_settings (
  household_id  uuid primary key references ovie.households (id) on delete cascade,
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  prefs         jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  updated_at    timestamptz not null default now()
);

create trigger household_settings_touch
  before update on ovie.household_settings
  for each row execute function ovie.touch_updated_at();

-- Per person (or per device) preferences, e.g. theme.
create table ovie.member_settings (
  household_id  uuid not null,
  user_id       uuid not null,
  theme         text not null default 'system' check (theme in ('system', 'light', 'dark')),
  prefs         jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  updated_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  foreign key (household_id, user_id)
    references ovie.household_members (household_id, user_id) on delete cascade
);

create trigger member_settings_touch
  before update on ovie.member_settings
  for each row execute function ovie.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table ovie.households         enable row level security;
alter table ovie.household_members  enable row level security;
alter table ovie.household_invites  enable row level security;
alter table ovie.household_settings enable row level security;
alter table ovie.member_settings    enable row level security;

-- households: members read; owners rename / change timezone.
-- Creation and deletion only happen through RPCs / the dashboard.
create policy households_select on ovie.households
  for select to authenticated
  using (ovie.is_member(id));

create policy households_update on ovie.households
  for update to authenticated
  using (ovie.has_role(id, array['owner']))
  with check (ovie.has_role(id, array['owner']));

-- household_members: members see each other.
create policy members_select on ovie.household_members
  for select to authenticated
  using (ovie.is_member(household_id));

-- Anyone can edit their own name/colour (column grants below stop them
-- changing their role); owners can edit anyone's.
create policy members_update on ovie.household_members
  for update to authenticated
  using (user_id = (select auth.uid()) or ovie.has_role(household_id, array['owner']))
  with check (user_id = (select auth.uid()) or ovie.has_role(household_id, array['owner']));

-- Owners remove other people/devices; anyone but an owner can leave.
create policy members_delete on ovie.household_members
  for delete to authenticated
  using (
    (ovie.has_role(household_id, array['owner']) and user_id <> (select auth.uid()))
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- household_invites: owners only. Creation goes through create_invite().
create policy invites_select on ovie.household_invites
  for select to authenticated
  using (ovie.has_role(household_id, array['owner']));

create policy invites_delete on ovie.household_invites
  for delete to authenticated
  using (ovie.has_role(household_id, array['owner']));

-- household_settings: everyone in the household reads; people (not devices)
-- change them.
create policy household_settings_select on ovie.household_settings
  for select to authenticated
  using (ovie.is_member(household_id));

create policy household_settings_update on ovie.household_settings
  for update to authenticated
  using (ovie.has_role(household_id, array['owner', 'member']))
  with check (ovie.has_role(household_id, array['owner', 'member']));

-- member_settings: your own row only.
create policy member_settings_select on ovie.member_settings
  for select to authenticated
  using (user_id = (select auth.uid()) and ovie.is_member(household_id));

create policy member_settings_insert on ovie.member_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and ovie.is_member(household_id));

create policy member_settings_update on ovie.member_settings
  for update to authenticated
  using (user_id = (select auth.uid()) and ovie.is_member(household_id))
  with check (user_id = (select auth.uid()) and ovie.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Table privileges (RLS still applies on top of these)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema ovie from public, anon, authenticated;

grant select, update (name, timezone)           on ovie.households         to authenticated;
grant select, delete, update (display_name, colour)
                                                on ovie.household_members  to authenticated;
grant select, delete                            on ovie.household_invites  to authenticated;
grant select, update (week_starts_on, prefs)    on ovie.household_settings to authenticated;
grant select, insert (household_id, user_id, theme, prefs), update (theme, prefs)
                                                on ovie.member_settings    to authenticated;

grant all on all tables in schema ovie to service_role;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a household with the caller as owner. Atomic.
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
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone: %', p_timezone using errcode = '22023';
  end if;

  insert into ovie.households (name, timezone, created_by)
  values (btrim(p_name), p_timezone, v_uid)
  returning id into v_household_id;

  insert into ovie.household_members (household_id, user_id, role, display_name)
  values (v_household_id, v_uid, 'owner', btrim(p_display_name));

  insert into ovie.household_settings (household_id) values (v_household_id);
  insert into ovie.member_settings (household_id, user_id) values (v_household_id, v_uid);

  return v_household_id;
end;
$$;

-- Owner creates an invite code for a person ('member') or the kiosk ('device').
create or replace function ovie.create_invite(p_household_id uuid, p_role text default 'member')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not ovie.has_role(p_household_id, array['owner']) then
    raise exception 'Only an owner can invite' using errcode = '42501';
  end if;
  if p_role not in ('member', 'device') then
    raise exception 'Invalid role: %', p_role using errcode = '22023';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into ovie.household_invites (household_id, code, role, created_by)
      values (p_household_id, v_code, p_role, auth.uid());
      exit;
    exception when unique_violation then
      -- vanishingly rare; try another code
    end;
  end loop;

  return v_code;
end;
$$;

-- Signed-in user redeems an invite. Single use, expires, atomic.
create or replace function ovie.accept_invite(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite ovie.household_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_invite
  from ovie.household_invites
  where code = upper(btrim(p_code))
  for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'That invite code is not valid' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from ovie.household_members
    where household_id = v_invite.household_id and user_id = v_uid
  ) then
    raise exception 'You are already in this household' using errcode = '23505';
  end if;

  insert into ovie.household_members (household_id, user_id, role, display_name)
  values (v_invite.household_id, v_uid, v_invite.role, btrim(p_display_name));

  insert into ovie.member_settings (household_id, user_id)
  values (v_invite.household_id, v_uid);

  update ovie.household_invites
  set used_at = now(), used_by = v_uid
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

-- Function privileges: authenticated only.
revoke all on all functions in schema ovie from public, anon;
grant execute on function ovie.is_member(uuid)                     to authenticated;
grant execute on function ovie.has_role(uuid, text[])              to authenticated;
grant execute on function ovie.create_household(text, text, text)  to authenticated;
grant execute on function ovie.create_invite(uuid, text)           to authenticated;
grant execute on function ovie.accept_invite(text, text)           to authenticated;
grant all on all functions in schema ovie to service_role;
