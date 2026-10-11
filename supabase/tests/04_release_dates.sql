-- Release dates on titles (when the next episode / a film comes out). ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Delete-free.
do $test$
declare
  pc uuid := gen_random_uuid();
  h uuid; t uuid; passed int := 0;
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

  -- 1. a paired device can set a weekly release on a show, change it, and clear it
  insert into ovie.titles (household_id, kind, name, seasons, release_season, release_episode, release_on, release_pace)
    values (h, 'show', 'Test weekly show', '{10,8}', 2, 3, current_date + 4, 'weekly') returning id into t;
  update ovie.titles set release_pace = 'all', release_on = current_date + 1 where id = t;
  update ovie.titles set release_season = null, release_episode = null, release_on = null where id = t;
  if (select release_on from ovie.titles where id = t) is not null then raise exception 'FAIL 1: clearing a release'; end if;
  update ovie.titles set release_season = 1, release_episode = 4, release_on = current_date + 2, release_pace = 'weekly', release_days = '{4,5}' where id = t;
  if (select release_days from ovie.titles where id = t) <> '{4,5}'::smallint[] then raise exception 'FAIL 1: Thursday and Friday'; end if;
  passed := passed + 1;

  -- 2. a film can have just a date; plain titles still need nothing
  insert into ovie.titles (household_id, kind, name, release_on) values (h, 'film', 'Test film', current_date + 30);
  insert into ovie.titles (household_id, kind, name) values (h, 'film', 'Test old film');
  passed := passed + 1;

  -- 3. broken shapes are refused
  begin
    insert into ovie.titles (household_id, kind, name, seasons, release_season, release_on) values (h, 'show', 'x', '{5}', 1, current_date);
    raise exception 'FAIL 3: season without an episode accepted';
  exception when check_violation then null; end;
  begin
    insert into ovie.titles (household_id, kind, name, seasons, release_season, release_episode) values (h, 'show', 'x', '{5}', 1, 2);
    raise exception 'FAIL 3: episode without a date accepted';
  exception when check_violation then null; end;
  begin
    insert into ovie.titles (household_id, kind, name, release_season, release_episode, release_on) values (h, 'film', 'x', 1, 1, current_date);
    raise exception 'FAIL 3: film with an episode accepted';
  exception when check_violation then null; end;
  begin
    insert into ovie.titles (household_id, kind, name, release_on, release_pace) values (h, 'film', 'x', current_date, 'daily');
    raise exception 'FAIL 3: unknown pace accepted';
  exception when check_violation then null; end;
  begin
    update ovie.titles set release_days = '{4,9}' where id = t;
    raise exception 'FAIL 3: a weekday of 9 accepted';
  exception when check_violation then null; end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % release-date checks', passed;
end $test$;
