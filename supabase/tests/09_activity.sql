-- "What's new": changes from a device are recorded with who made them. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …".
do $test$
declare
  pc uuid := gen_random_uuid(); h uuid; andrew uuid; dev uuid; t uuid; nid uuid; n int; a record; passed int := 0;
begin
  insert into auth.users (id, email, aud, role) values (pc, null, 'authenticated', 'authenticated');
  select id into h from ovie.households limit 1;
  select id into andrew from ovie.members where household_id = h order by created_at limit 1;
  insert into ovie.devices (household_id, user_id, member_id, kind, label) values (h, pc, andrew, 'personal', 'Test phone') returning id into dev;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. adding a job is recorded, with the person and device
  insert into ovie.tasks (household_id, title, due_on, repeat_every, repeat_unit, series_id)
  values (h, 'Test bins', current_date, 1, 'week', gen_random_uuid()) returning id into t;
  select * into a from ovie.activity where ref_id = t order by id desc limit 1;
  if a is null or a.action <> 'added' or a.kind <> 'task' or a.actor_member <> andrew or a.actor_device <> dev or a.title <> 'Test bins'
    then raise exception 'FAIL 1: added job %', row_to_json(a); end if;
  passed := passed + 1;

  -- 2. ticking a repeating job: "done", and the next round is not news
  perform ovie.complete_task(t, andrew);
  select count(*) into n from ovie.activity where household_id = h and kind = 'task' and actor_user = pc;
  if n <> 2 then raise exception 'FAIL 2: expected added + done, got %', n; end if;
  if not exists (select 1 from ovie.activity where ref_id = t and action = 'done') then raise exception 'FAIL 2: no done'; end if;
  passed := passed + 1;

  -- 3. a note, then changing it twice quickly: one "added" entry, kept up to date
  insert into ovie.notes (household_id, body, from_member) values (h, 'Test note', andrew) returning id into nid;
  update ovie.notes set body = 'Test note 2' where id = nid;
  update ovie.notes set body = 'Test note 3' where id = nid;
  select count(*) into n from ovie.activity where ref_id = nid;
  if n <> 1 then raise exception 'FAIL 3: expected one entry for the note, got %', n; end if;
  if (select title from ovie.activity where ref_id = nid) <> 'Test note 3' then raise exception 'FAIL 3: title not updated'; end if;
  passed := passed + 1;

  -- 4. devices can read it but not write it
  begin
    insert into ovie.activity (household_id, kind, action) values (h, 'task', 'added');
    raise exception 'FAIL 4: device wrote to activity';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 5. a broken entry never stops the save (pinning a note: not news, still saved)
  update ovie.notes set pinned = true where id = nid;
  if not (select pinned from ovie.notes where id = nid) then raise exception 'FAIL 5: pin not saved'; end if;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % checks', passed;
end
$test$;
