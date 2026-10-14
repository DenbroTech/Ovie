-- Job rewards and note hearts. ALWAYS rolls back. Expected: ERROR "OVIE TESTS PASSED: …".
do $test$
declare
  pc uuid := gen_random_uuid(); h uuid; a uuid; b uuid; dev uuid; t uuid; nxt uuid; nid uuid; n int; passed int := 0;
begin
  insert into auth.users (id, email, aud, role) values (pc, null, 'authenticated', 'authenticated');
  select id into h from ovie.households limit 1;
  select id into a from ovie.members where household_id = h order by created_at limit 1;
  select id into b from ovie.members where household_id = h and id <> a order by created_at limit 1;
  insert into ovie.devices (household_id, user_id, member_id, kind, label) values (h, pc, b, 'personal', 'Test phone') returning id into dev;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. A sets a job worth +3 and a treat; B ticks it: B gets +3 from A, marked with the job
  insert into ovie.tasks (household_id, title, created_by, reward_points, reward_text, due_on, repeat_every, repeat_unit, series_id)
  values (h, 'Test bins', a, 3, 'Pizza night', current_date, 1, 'week', gen_random_uuid()) returning id into t;
  nxt := ovie.complete_task(t, b);
  select count(*) into n from ovie.meter_points where task_id = t and to_member = b and from_member = a and points = 3 and reason = 'Did the job: Test bins';
  if n <> 1 then raise exception 'FAIL 1: reward points not given'; end if;
  passed := passed + 1;

  -- 2. the next round of the repeating job keeps its reward
  if not exists (select 1 from ovie.tasks where id = nxt and reward_points = 3 and reward_text = 'Pizza night') then raise exception 'FAIL 2: next round lost the reward'; end if;
  passed := passed + 1;

  -- 3. unticking takes the points back
  perform ovie.uncomplete_task(t);
  if exists (select 1 from ovie.meter_points where task_id = t) then raise exception 'FAIL 3: points not taken back'; end if;
  passed := passed + 1;

  -- 4. ticking your own rewarded job still gives you the points (from nobody)
  update ovie.tasks set created_by = b where id = t;
  perform ovie.complete_task(t, b);
  if not exists (select 1 from ovie.meter_points where task_id = t and to_member = b and from_member is null) then raise exception 'FAIL 4: own job reward'; end if;
  passed := passed + 1;

  -- 5. a heart on a note, once per device, shown in What's new; can't heart as another device
  insert into ovie.notes (household_id, body, from_member) values (h, 'Test heart note', a) returning id into nid;
  insert into ovie.note_likes (note_id, device_id, household_id, member_id) values (nid, dev, h, b);
  begin
    insert into ovie.note_likes (note_id, device_id, household_id, member_id) values (nid, dev, h, b);
    raise exception 'FAIL 5: two hearts from one device';
  exception when unique_violation then null;
  end;
  if not exists (select 1 from ovie.activity where kind = 'note' and action = 'liked' and ref_id = nid and info->>'note_from' = a::text) then
    raise exception 'FAIL 5: heart not in What''s new'; end if;
  begin
    insert into ovie.note_likes (note_id, device_id, household_id, member_id)
    select nid, d.id, h, null from ovie.devices d where d.household_id = h and d.id <> dev limit 1;
    if found then raise exception 'FAIL 5: hearted as another device'; end if;
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % checks', passed;
end
$test$;
