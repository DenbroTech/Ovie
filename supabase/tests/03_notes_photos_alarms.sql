-- Notes, photos (+ storage policies), alarms, finance trend. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Delete-free except via storage policy checks.
do $test$
declare
  pc uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  h uuid; andrew uuid; n int; j jsonb; audit_before int; passed int := 0;
begin
  insert into auth.users (id, email, aud, role)
  select u, null, 'authenticated', 'authenticated' from unnest(array[pc, x]) u;
  select count(*) into audit_before from public.audit_log;

  select id into h from ovie.households limit 1;
  if h is null then
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);
    h := ovie.setup_household('Home', 'Andrew', 'Australia/Sydney');
    perform set_config('role', 'postgres', true);
  else
    insert into ovie.devices (household_id, user_id, kind, label) values (h, pc, 'wall', 'Test screen');
  end if;
  select id into andrew from ovie.members where household_id = h order by created_at limit 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. notes: leave one for a person and one for everyone, mark done
  insert into ovie.notes (household_id, body, from_member, to_member) values (h, 'Gone to gym, back at 7', andrew, andrew);
  insert into ovie.notes (household_id, body, from_member) values (h, 'Plumber coming Tuesday', andrew);
  update ovie.notes set done_at = now() where household_id = h and body = 'Plumber coming Tuesday';
  select count(*) into n from ovie.notes where household_id = h and done_at is null and body = 'Gone to gym, back at 7';
  if n <> 1 then raise exception 'FAIL 1: notes'; end if;
  begin
    insert into ovie.notes (household_id, body, to_member) values (h, 'x', gen_random_uuid());
    raise exception 'FAIL 1: note to unknown person accepted';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 2. photos: path must sit in this household's folder
  insert into ovie.photos (household_id, path, width, height) values (h, h::text || '/beach.jpg', 1600, 1200);
  begin
    insert into ovie.photos (household_id, path) values (h, gen_random_uuid()::text || '/x.jpg');
    raise exception 'FAIL 2: photo outside household folder accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 3. storage: paired device may upload/read in its household folder only
  if not ovie.photo_path_allowed(h::text || '/a.jpg') then raise exception 'FAIL 3: own folder refused'; end if;
  if ovie.photo_path_allowed(gen_random_uuid()::text || '/a.jpg') then raise exception 'FAIL 3: other folder allowed'; end if;
  if ovie.photo_path_allowed('../../etc/passwd') then raise exception 'FAIL 3: junk path allowed'; end if;
  insert into storage.objects (bucket_id, name) values ('ovie-photos', h::text || '/a.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('ovie-photos', gen_random_uuid()::text || '/b.jpg');
    raise exception 'FAIL 3: upload to another folder accepted';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 4. alarms: repeating needs days, one-off needs a date; bad weekday refused
  insert into ovie.alarms (household_id, label, at_time, days) values (h, 'Bins out', '19:00', '{0,3}');
  insert into ovie.alarms (household_id, label, at_time, on_date) values (h, 'Pick up Lina', '17:30', current_date + 1);
  begin
    insert into ovie.alarms (household_id, label, at_time) values (h, 'x', '07:00');
    raise exception 'FAIL 4: alarm with no day accepted';
  exception when check_violation then null;
  end;
  begin
    insert into ovie.alarms (household_id, label, at_time, days) values (h, 'x', '07:00', '{7}');
    raise exception 'FAIL 4: weekday 7 accepted';
  exception when check_violation then null;
  end;
  update ovie.alarms set last_dismissed_for = now(), snoozed_until = null where household_id = h and label = 'Bins out';
  passed := passed + 1;

  -- 5. finance trend: one entry per month, read-only
  j := ovie.casa_trend(6);
  if jsonb_array_length(j) <> 6 or jsonb_typeof(j->0->'spent') <> 'array' then raise exception 'FAIL 5: trend shape %', j; end if;
  if jsonb_array_length(ovie.casa_trend(100)) <> 24 then raise exception 'FAIL 5: trend not capped at 24 months'; end if;
  passed := passed + 1;

  -- 6. stranger: sees nothing, can't read the trend or touch photos
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from ovie.notes; if n <> 0 then raise exception 'FAIL 6: stranger sees notes'; end if;
  select count(*) into n from ovie.photos; if n <> 0 then raise exception 'FAIL 6: stranger sees photos'; end if;
  select count(*) into n from ovie.alarms; if n <> 0 then raise exception 'FAIL 6: stranger sees alarms'; end if;
  select count(*) into n from storage.objects where bucket_id = 'ovie-photos'; if n <> 0 then raise exception 'FAIL 6: stranger sees photo files'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('ovie-photos', h::text || '/sneaky.jpg');
    raise exception 'FAIL 6: stranger uploaded a photo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform ovie.casa_trend(6);
    raise exception 'FAIL 6: stranger read the trend';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 7. anon gets nothing
  perform set_config('role', 'anon', true);
  begin
    perform ovie.casa_trend(6);
    raise exception 'FAIL 7: anon read the trend';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- 8. ₲ryd untouched
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.audit_log;
  if n <> audit_before then raise exception 'FAIL 8: Gryd audit log changed'; end if;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % notes/photos/alarms checks (rolled back)', passed;
end
$test$;
