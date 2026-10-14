-- Deadlines with alarms, and calendar repeats every N. ALWAYS rolls back. Expected: ERROR "OVIE TESTS PASSED: …".
do $test$
declare
  pc uuid := gen_random_uuid(); h uuid; a uuid; t uuid; nxt uuid; passed int := 0;
begin
  insert into auth.users (id, email, aud, role) values (pc, null, 'authenticated', 'authenticated');
  select id into h from ovie.households limit 1;
  select id into a from ovie.members where household_id = h order by created_at limit 1;
  insert into ovie.devices (household_id, user_id, member_id, kind, label) values (h, pc, a, 'personal', 'Test phone');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. a deadline with an alarm makes one alarm at that time, for the person it's for
  insert into ovie.tasks (household_id, title, assignee_id, due_on, due_time, remind, in_calendar, repeat_every, repeat_unit, series_id)
  values (h, 'Test rego', a, current_date + 3, '18:30', true, true, 2, 'week', gen_random_uuid()) returning id into t;
  if not exists (select 1 from ovie.alarms where task_id = t and label = 'Due: Test rego' and at_time = '18:30' and on_date = current_date + 3 and member_id = a and enabled)
    then raise exception 'FAIL 1: no alarm'; end if;
  passed := passed + 1;

  -- 2. moving the deadline moves the alarm; no time means 9am
  update ovie.tasks set due_on = current_date + 5, due_time = null where id = t;
  if not exists (select 1 from ovie.alarms where task_id = t and at_time = '09:00' and on_date = current_date + 5) then raise exception 'FAIL 2: alarm not moved'; end if;
  passed := passed + 1;

  -- 3. done: the alarm goes; the next round gets its own alarm, calendar and time
  nxt := ovie.complete_task(t, a);
  if exists (select 1 from ovie.alarms where task_id = t) then raise exception 'FAIL 3: alarm left after done'; end if;
  if not exists (select 1 from ovie.tasks where id = nxt and remind and in_calendar) or not exists (select 1 from ovie.alarms where task_id = nxt)
    then raise exception 'FAIL 3: next round lost its alarm'; end if;
  passed := passed + 1;

  -- 4. switching the alarm off removes it
  update ovie.tasks set remind = false where id = nxt;
  if exists (select 1 from ovie.alarms where task_id = nxt) then raise exception 'FAIL 4: alarm not removed'; end if;
  passed := passed + 1;

  -- 5. events repeat every N (1-52)
  insert into ovie.events (household_id, title, starts_at, all_day, repeat, repeat_every) values (h, 'Test bin day', now(), true, 'weekly', 7);
  begin
    insert into ovie.events (household_id, title, starts_at, all_day, repeat, repeat_every) values (h, 'x', now(), true, 'weekly', 0);
    raise exception 'FAIL 5: every 0 accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % checks', passed;
end
$test$;
