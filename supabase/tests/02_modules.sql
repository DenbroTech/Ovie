-- Core module tests: tasks + repeats, shopping, calendar, watch, finances (read-only).
-- ALWAYS rolls back. Expected outcome: ERROR "OVIE TESTS PASSED: …".
-- Delete-free, so it can also run through the Supabase MCP connector.
do $test$
declare
  pc uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  h uuid; andrew uuid; t1 uuid; t2 uuid; nxt uuid; nxt2 uuid; lst uuid; it uuid; ti uuid; d date;
  n int; j jsonb; audit_before int; passed int := 0;
begin
  insert into auth.users (id, email, aud, role)
  select u, null, 'authenticated', 'authenticated' from unnest(array[pc, x]) u;
  select count(*) into audit_before from public.audit_log;

  -- Use the existing household if Ovie is already set up; otherwise make one.
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

  -- 1. default shopping lists exist
  select count(*) into n from ovie.shopping_lists where household_id = h;
  if n < 3 then raise exception 'FAIL 1: expected default lists, got %', n; end if;
  passed := passed + 1;

  -- 2. a simple task: complete and undo
  insert into ovie.tasks (household_id, title, assignee_id, created_by) values (h, 'Book dentist', andrew, andrew) returning id into t1;
  nxt := ovie.complete_task(t1, andrew);
  if nxt is not null then raise exception 'FAIL 2: non-repeating task made a next one'; end if;
  select count(*) into n from ovie.tasks where id = t1 and completed_by = andrew and completed_at is not null;
  if n <> 1 then raise exception 'FAIL 2: not completed'; end if;
  perform ovie.uncomplete_task(t1);
  select count(*) into n from ovie.tasks where id = t1 and completed_at is null;
  if n <> 1 then raise exception 'FAIL 2: undo failed'; end if;
  passed := passed + 1;

  -- 3. repeating weekly task: next occurrence created exactly once, even if completed twice / redone
  d := ovie.household_today(h) + 1;
  insert into ovie.tasks (household_id, title, due_on, repeat_every, repeat_unit) values (h, 'Bins out', d, 1, 'week') returning id into t2;
  nxt := ovie.complete_task(t2, null);
  if nxt is null then raise exception 'FAIL 3: no next occurrence'; end if;
  select count(*) into n from ovie.tasks where id = nxt and due_on = d + 7 and completed_at is null;
  if n <> 1 then raise exception 'FAIL 3: next occurrence wrong date'; end if;
  if ovie.complete_task(t2, null) is not null then raise exception 'FAIL 3: retry created another'; end if;
  perform ovie.uncomplete_task(t2);
  nxt2 := ovie.complete_task(t2, null);
  select count(*) into n from ovie.tasks where title = 'Bins out' and household_id = h;
  if n <> 2 then raise exception 'FAIL 3: expected 2 occurrences after undo+redo, got %', n; end if;
  passed := passed + 1;

  -- 4. overdue repeating task done late jumps to a future date
  insert into ovie.tasks (household_id, title, due_on, repeat_every, repeat_unit)
  values (h, 'Water plants', ovie.household_today(h) - 10, 3, 'day') returning id into t2;
  nxt := ovie.complete_task(t2, null);
  select due_on into d from ovie.tasks where id = nxt;
  if d <= ovie.household_today(h) then raise exception 'FAIL 4: next due % is not in the future', d; end if;
  passed := passed + 1;

  -- 5. repeat needs a due date; bad assignee refused
  begin
    insert into ovie.tasks (household_id, title, repeat_every, repeat_unit) values (h, 'x', 1, 'week');
    raise exception 'FAIL 5: repeat without due date accepted';
  exception when check_violation then null;
  end;
  begin
    insert into ovie.tasks (household_id, title, assignee_id) values (h, 'x', gen_random_uuid());
    raise exception 'FAIL 5: unknown assignee accepted';
  exception when insufficient_privilege then null;
  end;
  passed := passed + 1;

  -- 6. shopping: add, tick, clear
  select id into lst from ovie.shopping_lists where household_id = h order by sort limit 1;
  insert into ovie.shopping_items (household_id, list_id, name, qty) values (h, lst, 'Oat milk', '2') returning id into it;
  update ovie.shopping_items set checked_at = now(), checked_by = andrew where id = it;
  update ovie.shopping_items set cleared_at = now() where id = it and checked_at is not null;
  select count(*) into n from ovie.shopping_items where id = it and cleared_at is not null;
  if n <> 1 then raise exception 'FAIL 6: tick/clear failed'; end if;
  passed := passed + 1;

  -- 7. calendar: event saved; end before start refused
  insert into ovie.events (household_id, title, starts_at, repeat) values (h, 'Yoga', now() + interval '1 day', 'weekly');
  begin
    insert into ovie.events (household_id, title, starts_at, ends_at) values (h, 'x', now(), now() - interval '1 hour');
    raise exception 'FAIL 7: end before start accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 8. watch: individual and together progress are separate; duplicates ignored
  insert into ovie.titles (household_id, kind, name, seasons, status) values (h, 'show', 'The Series', '{10,8}', 'watching') returning id into ti;
  insert into ovie.viewings (household_id, title_id, member_id, season, episode) values (h, ti, null, 1, 1), (h, ti, null, 1, 2);
  insert into ovie.viewings (household_id, title_id, member_id, season, episode) values (h, ti, andrew, 1, 1);
  insert into ovie.viewings (household_id, title_id, member_id, season, episode) values (h, ti, null, 1, 2) on conflict do nothing;
  select count(*) into n from ovie.viewings where title_id = ti and member_id is null;
  if n <> 2 then raise exception 'FAIL 8: together count %', n; end if;
  select count(*) into n from ovie.viewings where title_id = ti and member_id = andrew;
  if n <> 1 then raise exception 'FAIL 8: individual count %', n; end if;
  begin
    insert into ovie.titles (household_id, kind, name, seasons) values (h, 'film', 'Film', '{3}');
    raise exception 'FAIL 8: film with seasons accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 9. finances: paired device can read the summary; it is read-only
  j := ovie.casa_summary(null);
  if j ? 'spent' is not true or jsonb_typeof(j->'recent') <> 'array' or jsonb_typeof(j->'people') <> 'array' then
    raise exception 'FAIL 9: summary shape %', j;
  end if;
  passed := passed + 1;

  -- 10. strangers: no rows, no finances, cannot complete tasks or add items
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from ovie.tasks; if n <> 0 then raise exception 'FAIL 10: stranger sees tasks'; end if;
  select count(*) into n from ovie.shopping_items; if n <> 0 then raise exception 'FAIL 10: stranger sees items'; end if;
  select count(*) into n from ovie.events; if n <> 0 then raise exception 'FAIL 10: stranger sees events'; end if;
  select count(*) into n from ovie.titles; if n <> 0 then raise exception 'FAIL 10: stranger sees titles'; end if;
  begin
    perform ovie.casa_summary(null);
    raise exception 'FAIL 10: stranger read finances';
  exception when insufficient_privilege then null;
  end;
  begin
    perform ovie.complete_task(t1, null);
    raise exception 'FAIL 10: stranger completed a task';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into ovie.shopping_items (household_id, list_id, name) values (h, lst, 'Intruder');
    raise exception 'FAIL 10: stranger added an item';
  exception when insufficient_privilege or foreign_key_violation then null; -- refused either way
  end;
  passed := passed + 1;

  -- 11. anon cannot call finances at all
  perform set_config('role', 'anon', true);
  begin
    perform ovie.casa_summary(null);
    raise exception 'FAIL 11: anon read finances';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- 12. nothing was written to ₲ryd's audit log
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.audit_log;
  if n <> audit_before then raise exception 'FAIL 12: ₲ryd audit log changed'; end if;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % module checks (rolled back)', passed;
end
$test$;
