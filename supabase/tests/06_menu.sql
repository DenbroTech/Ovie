-- The Menu: saved meals planned onto days as events. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Delete-free.
do $test$
declare
  pc uuid := gen_random_uuid();
  h uuid; m uuid; e uuid; n int; passed int := 0;
begin
  insert into auth.users (id, email, aud, role) values (pc, null, 'authenticated', 'authenticated');
  select id into h from ovie.households limit 1;
  if h is null then
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);
    h := ovie.setup_household('Home', 'Andrew', 'Australia/Sydney');
    perform set_config('role', 'postgres', true);
  else
    insert into ovie.devices (household_id, user_id, kind, label) values (h, pc, 'wall', 'Test screen');
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. save a meal and plan it for a day (an all-day event linked to the meal)
  insert into ovie.meals (household_id, name, emoji) values (h, 'Pizza night', '🍕') returning id into m;
  insert into ovie.events (household_id, title, starts_at, all_day, meal_id)
    values (h, 'Pizza night', now() + interval '2 days', true, m) returning id into e;
  select count(*) into n from ovie.events where meal_id = m;
  if n <> 1 then raise exception 'FAIL 1: planned meal'; end if;
  passed := passed + 1;

  -- 2. an unknown meal can't be planned
  begin
    insert into ovie.events (household_id, title, starts_at, all_day, meal_id) values (h, 'x', now(), true, gen_random_uuid());
    raise exception 'FAIL 2: unknown meal accepted';
  exception when foreign_key_violation then null; end;
  passed := passed + 1;

  -- 3. names are required and short
  begin
    insert into ovie.meals (household_id, name) values (h, '   ');
    raise exception 'FAIL 3: empty name accepted';
  exception when check_violation then null; end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % menu checks', passed;
end $test$;
