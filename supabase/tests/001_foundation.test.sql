-- Foundation: households, members, invites, settings, RLS and grants.
-- Runs inside one transaction and rolls back.
begin;

create function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAILED: %', p_msg; end if;
end $$;

-- Expect p_sql to raise. Optionally match the SQLSTATE.
create function pg_temp.throws(p_sql text, p_msg text, p_state text default null)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAILED (no error): %', p_msg;
exception when others then
  if sqlerrm like 'FAILED (no error)%' then raise; end if;
  if p_state is not null and sqlstate <> p_state then
    raise exception 'FAILED: % (expected %, got % %)', p_msg, p_state, sqlstate, sqlerrm;
  end if;
end $$;

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'kiosk@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'outsider@example.test');

-- Shared state between steps (owned by postgres, readable by all roles here).
create temp table t (k text primary key, v text);
grant select, insert, update on t to authenticated, anon;

-- 1. Owner creates a household -------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into t values ('hid', ovie.create_household('Our Home', 'Andrew', 'Australia/Sydney')::text);

select pg_temp.ok((select count(*) from ovie.households) = 1, 'owner sees their household');
select pg_temp.ok((select role from ovie.household_members where user_id = auth.uid()) = 'owner', 'creator is owner');
select pg_temp.ok((select count(*) from ovie.household_settings) = 1, 'household settings row created');
select pg_temp.ok((select theme from ovie.member_settings) = 'system', 'member settings default to system theme');

select pg_temp.throws($$select ovie.create_household('X', 'Y', 'Mars/Olympus')$$, 'rejects unknown timezone', '22023');
select pg_temp.throws($$select ovie.create_household('', 'Y')$$, 'rejects blank household name', '23514');

-- Owner cannot change their own role (column grant), can rename household.
select pg_temp.throws(
  $$update ovie.household_members set role = 'member' where user_id = auth.uid()$$,
  'role column is not updatable', '42501');
update ovie.households set name = 'Home' where id = (select v::uuid from t where k = 'hid');
select pg_temp.ok((select name from ovie.households) = 'Home', 'owner can rename household');

-- Invites
insert into t values ('code_b', ovie.create_invite((select v::uuid from t where k = 'hid'), 'member'));
insert into t values ('code_k', ovie.create_invite((select v::uuid from t where k = 'hid'), 'device'));
select pg_temp.ok((select v from t where k = 'code_b') ~ '^[A-Z0-9]{8}$', 'invite code format');
select pg_temp.throws(
  format($$select ovie.create_invite(%L, 'owner')$$, (select v from t where k = 'hid')),
  'cannot invite an owner', '22023');
select pg_temp.ok((select count(*) from ovie.household_invites) = 2, 'owner sees invites');

-- 2. Outsider sees nothing and cannot act --------------------------------
reset role;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select pg_temp.ok((select count(*) from ovie.households) = 0, 'outsider sees no households');
select pg_temp.ok((select count(*) from ovie.household_members) = 0, 'outsider sees no members');
select pg_temp.ok((select count(*) from ovie.household_invites) = 0, 'outsider sees no invites');
select pg_temp.ok((select count(*) from ovie.household_settings) = 0, 'outsider sees no settings');
select pg_temp.throws(
  format($$select ovie.create_invite(%L)$$, (select v from t where k = 'hid')),
  'outsider cannot create invite', '42501');
update ovie.households set name = 'Hacked';
select pg_temp.throws($$insert into ovie.households (name) values ('x')$$, 'no direct household insert', '42501');
select pg_temp.throws(
  $$insert into ovie.household_members (household_id, user_id, role, display_name)
    select v::uuid, auth.uid(), 'owner', 'Me' from t where k = 'hid'$$,
  'no direct member insert', '42501');
select pg_temp.throws('select ovie.accept_invite(''ZZZZZZZZ'', ''Me'')', 'bogus invite rejected', 'P0002');

-- 3. Second person joins with an invite -----------------------------------
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.ok(
  ovie.accept_invite(lower((select v from t where k = 'code_b')), 'Partner') = (select v::uuid from t where k = 'hid'),
  'accept invite (case-insensitive) returns household');
select pg_temp.ok((select count(*) from ovie.household_members) = 2, 'member sees both members');
select pg_temp.ok((select role from ovie.household_members where user_id = auth.uid()) = 'member', 'invitee is member');
select pg_temp.ok((select count(*) from ovie.household_invites) = 0, 'member cannot see invites');
select pg_temp.ok((select count(*) from ovie.member_settings) = 1, 'member sees only own member_settings');
select pg_temp.throws(
  format($$select ovie.accept_invite(%L, 'Again')$$, (select v from t where k = 'code_b')),
  'invite is single use', 'P0002');

update ovie.household_members set display_name = 'Sam', colour = 'clay' where user_id = auth.uid();
select pg_temp.ok((select display_name from ovie.household_members where user_id = auth.uid()) = 'Sam', 'member edits own name');
update ovie.household_members set display_name = 'Nope' where user_id = '11111111-1111-1111-1111-111111111111';
update ovie.households set name = 'Nope';
update ovie.household_settings set week_starts_on = 0;
select pg_temp.ok((select week_starts_on from ovie.household_settings) = 0, 'member can change household settings');
update ovie.member_settings set theme = 'dark';

-- 4. Kiosk device joins ---------------------------------------------------
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select ovie.accept_invite((select v from t where k = 'code_k'), 'Kitchen screen');
select pg_temp.ok((select role from ovie.household_members where user_id = auth.uid()) = 'device', 'kiosk is device');
update ovie.household_settings set week_starts_on = 3;
select pg_temp.ok((select week_starts_on from ovie.household_settings) = 0, 'device cannot change household settings');
select pg_temp.throws(
  format($$select ovie.create_invite(%L)$$, (select v from t where k = 'hid')),
  'device cannot invite', '42501');

-- 5. Verify blocked writes really did nothing -----------------------------
reset role;
select pg_temp.ok((select name from ovie.households) = 'Home', 'outsider/member could not rename household');
select pg_temp.ok(
  (select display_name from ovie.household_members where user_id = '11111111-1111-1111-1111-111111111111') = 'Andrew',
  'member could not rename owner');
select pg_temp.ok(
  (select theme from ovie.member_settings where user_id = '22222222-2222-2222-2222-222222222222') = 'dark',
  'member changed own theme');

-- 6. Anon has no access at all --------------------------------------------
select pg_temp.as_anon();
select pg_temp.throws('select 1 from ovie.households', 'anon cannot read ovie tables', '42501');
select pg_temp.throws('select ovie.create_household(''x'',''y'')', 'anon cannot call RPCs', '42501');

-- 7. Membership removal ---------------------------------------------------
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
with d as (delete from ovie.household_members where user_id = auth.uid() returning 1)
select pg_temp.ok((select count(*) from d) = 0, 'owner cannot remove themselves');
with d as (delete from ovie.household_members where user_id = '33333333-3333-3333-3333-333333333333' returning 1)
select pg_temp.ok((select count(*) from d) = 1, 'owner can remove the device');
reset role;
select pg_temp.ok(
  (select count(*) from ovie.member_settings where user_id = '33333333-3333-3333-3333-333333333333') = 0,
  'removing a member cascades their settings');

-- 8. No ovie object leaked into public ------------------------------------
select pg_temp.ok(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'),
  'migrations created nothing in public');
select pg_temp.ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  'migrations created no functions in public');
select pg_temp.ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'ovie' and c.relkind = 'r' and not c.relrowsecurity),
  'every ovie table has RLS enabled');

rollback;
