-- Starred calendar entries with saved times. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Delete-free.
do $test$
declare
  pc uuid := gen_random_uuid();
  h uuid; f uuid; n int; passed int := 0;
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

  -- 1. save a favourite with two shifts, then add a third time
  insert into ovie.event_favourites (household_id, title, location, times)
    values (h, 'Working at Harvey''s', 'Harvey''s', '[{"label":"Early","from":"07:00","to":"15:00"},{"label":"Late","from":"15:00","to":"23:00"}]')
    returning id into f;
  update ovie.event_favourites set times = times || '[{"label":"Short","from":"10:00","to":"14:00"}]' where id = f;
  select jsonb_array_length(times) into n from ovie.event_favourites where id = f;
  if n <> 3 then raise exception 'FAIL 1: saved times'; end if;
  passed := passed + 1;

  -- 2. times must be a short list; someone from outside the home is refused
  begin
    update ovie.event_favourites set times = '{"from":"07:00"}' where id = f;
    raise exception 'FAIL 2: non-list times accepted';
  exception when check_violation then null; end;
  begin
    insert into ovie.event_favourites (household_id, title, member_id) values (h, 'x', gen_random_uuid());
    raise exception 'FAIL 2: unknown person accepted';
  exception when insufficient_privilege then null; end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % favourite checks', passed;
end $test$;
