-- Foundation tests: households, members, RLS.
-- Runs as real `authenticated` users and ALWAYS rolls back (the final RAISE aborts the transaction).
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Any other error = a failing assertion.
-- Run with psql, or locally with supabase/tests/local/run.sh. (The Supabase MCP connector holds
-- any SQL containing DELETE for a confirmation, so checks 11 and 14 can't run through it.)
do $test$
declare
  a uuid := gen_random_uuid();   -- Andrew
  l uuid := gen_random_uuid();   -- Lina
  k uuid := gen_random_uuid();   -- kiosk
  x uuid := gen_random_uuid();   -- stranger
  h uuid;
  h2 uuid;
  code text;
  n int;
  ok boolean;
  passed int := 0;
begin
  insert into auth.users (id, email, aud, role)
  values (a, 'a@test.ovie', 'authenticated', 'authenticated'),
         (l, 'l@test.ovie', 'authenticated', 'authenticated'),
         (k, 'k@test.ovie', 'authenticated', 'authenticated'),
         (x, 'x@test.ovie', 'authenticated', 'authenticated');

  -- helper: become a user
  -- (set_config with is_local = true keeps it inside this transaction)

  -- 1. anon cannot see the schema at all
  perform set_config('role', 'anon', true);
  begin
    perform count(*) from ovie.households;
    raise exception 'FAIL 1: anon could read ovie.households';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- 2. Andrew creates a household and becomes owner
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  h := ovie.create_household('Home', 'Andrew', 'Australia/Sydney');
  select count(*) into n from ovie.members where household_id = h and role = 'owner';
  if n <> 1 then raise exception 'FAIL 2: expected 1 owner, got %', n; end if;
  passed := passed + 1;

  -- 3. A second household for the same login is refused
  begin
    perform ovie.create_household('Other', 'Andrew');
    raise exception 'FAIL 3: second household allowed';
  exception when unique_violation then passed := passed + 1;
  end;

  -- 4. Bad timezone refused
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin
    perform ovie.create_household('X', 'X', 'Mars/Olympus');
    raise exception 'FAIL 4: bad timezone accepted';
  exception when invalid_parameter_value then passed := passed + 1;
  end;

  -- 5. Stranger sees nothing of Andrew's household
  select count(*) into n from ovie.households;
  if n <> 0 then raise exception 'FAIL 5: stranger sees % households', n; end if;
  select count(*) into n from ovie.members;
  if n <> 0 then raise exception 'FAIL 5: stranger sees % members', n; end if;
  passed := passed + 1;

  -- 6. Stranger cannot update Andrew's household (RLS filters to 0 rows)
  update ovie.households set name = 'pwned' where id = h;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 6: stranger updated household'; end if;
  passed := passed + 1;

  -- 7. Wrong invite code
  begin
    perform ovie.join_household('NOPE-NOPE', 'X');
    raise exception 'FAIL 7: bad code accepted';
  exception when no_data_found then passed := passed + 1;
  end;

  -- 8. Lina joins with the code (lower-case, spaces) and gets a different colour
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select invite_code into code from ovie.households where id = h;
  perform set_config('request.jwt.claims', json_build_object('sub', l, 'role', 'authenticated')::text, true);
  h2 := ovie.join_household('  ' || lower(code) || ' ', 'Lina');
  if h2 <> h then raise exception 'FAIL 8: joined wrong household'; end if;
  select count(distinct colour) into n from ovie.members where household_id = h;
  if n <> 2 then raise exception 'FAIL 8: colours not distinct'; end if;
  passed := passed + 1;

  -- 9. Lina cannot make herself owner
  begin
    update ovie.members set role = 'owner' where user_id = l;
    raise exception 'FAIL 9: Lina promoted herself';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- 10. Lina can rename herself but not Andrew
  update ovie.members set display_name = 'Lina M' where user_id = l;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 10: Lina could not rename herself'; end if;
  update ovie.members set display_name = 'Bob' where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 10: Lina renamed Andrew'; end if;
  passed := passed + 1;

  -- 11. Lina cannot delete Andrew; cannot rotate invite code
  delete from ovie.members where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL 11: Lina deleted Andrew'; end if;
  begin
    perform ovie.regenerate_invite_code(h);
    raise exception 'FAIL 11: Lina rotated invite code';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 12. Kiosk joins as device
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  perform ovie.join_household(code, 'Kiosk', 'device');
  select role = 'device' into ok from ovie.members where user_id = k;
  if not ok then raise exception 'FAIL 12: kiosk not device'; end if;
  begin
    perform ovie.join_household(code, 'Kiosk', 'owner');
    raise exception 'FAIL 12: owner role accepted on join';
  exception when invalid_parameter_value then null;
  end;
  passed := passed + 1;

  -- 13. Owner rotates the code; old code stops working
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if ovie.regenerate_invite_code(h) = code then raise exception 'FAIL 13: code unchanged'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin
    perform ovie.join_household(code, 'X');
    raise exception 'FAIL 13: old code still works';
  exception when no_data_found then passed := passed + 1;
  end;

  -- 14. Owner can remove the kiosk
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from ovie.members where user_id = k;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL 14: owner could not remove kiosk'; end if;
  passed := passed + 1;

  -- 15. Signed-out callers are refused by RPCs
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform ovie.create_household('Y', 'Y');
    raise exception 'FAIL 15: anonymous create_household';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  raise exception 'OVIE TESTS PASSED: % foundation checks (rolled back)', passed;
end
$test$;
