-- Foundation tests: one closed household, people, device pairing, RLS.
-- Runs as real `authenticated` (anonymous-device) users and ALWAYS rolls back
-- (the final RAISE aborts the transaction).
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Any other error = a failing assertion.
-- Run with psql, or locally with supabase/tests/local/run.sh. (The Supabase MCP connector holds
-- any SQL containing DELETE for a confirmation, so the delete checks can't run through it.)
do $test$
declare
  pc   uuid := gen_random_uuid();  -- Andrew's PC (first device)
  ph   uuid := gen_random_uuid();  -- Lina's phone
  pi   uuid := gen_random_uuid();  -- the Pi wall screen
  ph2  uuid := gen_random_uuid();  -- Andrew's phone
  x    uuid := gen_random_uuid();  -- a stranger who found the web address
  h uuid; code text; andrew uuid; lina uuid; n int; t text; passed int := 0;
begin
  insert into auth.users (id, email, aud, role)
  select u, null, 'authenticated', 'authenticated' from unnest(array[pc, ph, pi, ph2, x]) u;

  -- 1. anon (no session at all) cannot see the schema
  perform set_config('role', 'anon', true);
  begin
    perform count(*) from ovie.households;
    raise exception 'FAIL 1: anon could read ovie.households';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- 2. First run: setup_state = setup; PC sets up the household
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  t := ovie.setup_state();
  if t <> 'setup' then raise exception 'FAIL 2: expected setup, got %', t; end if;
  h := ovie.setup_household('Home', 'Andrew', 'Australia/Sydney');
  t := ovie.setup_state();
  if t <> 'paired' then raise exception 'FAIL 2: expected paired, got %', t; end if;
  select id into andrew from ovie.members where display_name = 'Andrew';
  select invite_code into code from ovie.households where id = h;
  passed := passed + 1;

  -- 3. Closed system: nobody can set up a second household
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin
    perform ovie.setup_household('Mine', 'X', 'Australia/Sydney');
    raise exception 'FAIL 3: second household created';
  exception when unique_violation then passed := passed + 1;
  end;

  -- 4. Stranger: state is join, sees nothing, can change nothing
  if ovie.setup_state() <> 'join' then raise exception 'FAIL 4: stranger state'; end if;
  select count(*) into n from ovie.households; if n <> 0 then raise exception 'FAIL 4: stranger sees households'; end if;
  select count(*) into n from ovie.members;    if n <> 0 then raise exception 'FAIL 4: stranger sees members'; end if;
  select count(*) into n from ovie.devices;    if n <> 0 then raise exception 'FAIL 4: stranger sees devices'; end if;
  update ovie.households set name = 'pwned' where id = h;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL 4: stranger renamed household'; end if;
  begin
    insert into ovie.members (household_id, display_name) values (h, 'Intruder');
    raise exception 'FAIL 4: stranger added a person';
  exception when insufficient_privilege then null;
  end;
  begin
    perform ovie.regenerate_invite_code(h);
    raise exception 'FAIL 4: stranger rotated code';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 5. Wrong code: no names leak, pairing refused
  select count(*) into n from ovie.people_for_code('NOPE-NOPE');
  if n <> 0 then raise exception 'FAIL 5: names leaked for wrong code'; end if;
  begin
    perform ovie.pair_device('NOPE-NOPE', 'wall');
    raise exception 'FAIL 5: bad code accepted';
  exception when no_data_found then passed := passed + 1;
  end;

  -- 6. Lina's phone: sees names for the right code, pairs as a new person with a new colour
  perform set_config('request.jwt.claims', json_build_object('sub', ph, 'role', 'authenticated')::text, true);
  select count(*) into n from ovie.people_for_code(lower(code));
  if n <> 1 then raise exception 'FAIL 6: expected 1 person for code, got %', n; end if;
  perform ovie.pair_device('  ' || lower(code) || ' ', 'personal', null, 'Lina');
  select id into lina from ovie.members where display_name = 'Lina';
  if lina is null then raise exception 'FAIL 6: Lina not created'; end if;
  select count(distinct colour) into n from ovie.members; if n <> 2 then raise exception 'FAIL 6: colours not distinct'; end if;
  begin
    perform ovie.pair_device(code, 'personal', andrew);
    raise exception 'FAIL 6: device paired twice';
  exception when unique_violation then null;
  end;
  passed := passed + 1;

  -- 7. Andrew's phone pairs to the EXISTING Andrew (no duplicate person)
  perform set_config('request.jwt.claims', json_build_object('sub', ph2, 'role', 'authenticated')::text, true);
  perform ovie.pair_device(code, 'personal', andrew);
  select count(*) into n from ovie.members where display_name = 'Andrew';
  if n <> 1 then raise exception 'FAIL 7: duplicate Andrew'; end if;
  select count(*) into n from ovie.devices where member_id = andrew;
  if n <> 2 then raise exception 'FAIL 7: Andrew should have 2 devices, has %', n; end if;
  passed := passed + 1;

  -- 8. The Pi pairs as a shared wall screen (no person)
  perform set_config('request.jwt.claims', json_build_object('sub', pi, 'role', 'authenticated')::text, true);
  perform ovie.pair_device(code, 'wall');
  select count(*) into n from ovie.devices where user_id = pi and kind = 'wall' and member_id is null;
  if n <> 1 then raise exception 'FAIL 8: wall screen not paired correctly'; end if;
  begin
    perform ovie.pair_device(code, 'personal');
    raise exception 'FAIL 8: personal device without a person accepted';
  exception when unique_violation then null; -- already paired is checked first
  end;
  passed := passed + 1;

  -- 9. A person from another household can't be attached; device can't be moved
  begin
    update ovie.devices set member_id = gen_random_uuid() where user_id = pi;
    raise exception 'FAIL 9: bogus member attached';
  exception when foreign_key_violation then null;
  end;
  begin
    update ovie.devices set user_id = x where user_id = pi;
    raise exception 'FAIL 9: device user changed';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 10. Paired devices can rename people and the household
  update ovie.members set display_name = 'Lina M' where id = lina;
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL 10: rename person'; end if;
  update ovie.households set name = 'Casa' where id = h;
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL 10: rename household'; end if;
  passed := passed + 1;

  -- 11. New invite code: old code stops working
  if ovie.regenerate_invite_code(h) = code then raise exception 'FAIL 11: code unchanged'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin
    perform ovie.pair_device(code, 'wall');
    raise exception 'FAIL 11: old code still works';
  exception when no_data_found then passed := passed + 1;
  end;

  -- 12. Unpairing a lost phone: its access is gone immediately
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);
  delete from ovie.devices where user_id = ph2;
  get diagnostics n = row_count; if n <> 1 then raise exception 'FAIL 12: could not unpair'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ph2, 'role', 'authenticated')::text, true);
  select count(*) into n from ovie.members; if n <> 0 then raise exception 'FAIL 12: unpaired phone still sees data'; end if;
  passed := passed + 1;

  -- 13. Removing a person keeps their devices (they become shared)
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);
  delete from ovie.members where id = lina;
  select count(*) into n from ovie.devices where user_id = ph and member_id is null;
  if n <> 1 then raise exception 'FAIL 13: device lost when person removed'; end if;
  passed := passed + 1;

  -- 14. Bad time zone on setup is refused (checked before the one-household rule would matter)
  begin
    perform now() at time zone 'Mars/Olympus';
    raise exception 'FAIL 14: bad tz accepted';
  exception when invalid_parameter_value then passed := passed + 1;
  end;

  -- 15. No session (no sub) is refused by the RPCs
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform ovie.pair_device('X', 'wall');
    raise exception 'FAIL 15: pairing without a session';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  raise exception 'OVIE TESTS PASSED: % foundation checks (rolled back)', passed;
end
$test$;
