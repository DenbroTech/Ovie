-- Oviemeter genie: wishes, 3 points when granted, 3 points off the other person when missed. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …".
do $test$
declare
  pc uuid := gen_random_uuid(); h uuid; a uuid; b uuid; w uuid; w2 uuid; n int; passed int := 0;
begin
  insert into auth.users (id, email, aud, role) values (pc, null, 'authenticated', 'authenticated');
  select id into h from ovie.households limit 1;
  select id into a from ovie.members where household_id = h order by created_at limit 1;
  select id into b from ovie.members where household_id = h and id <> a order by created_at limit 1;
  if b is null then insert into ovie.members (household_id, display_name, colour) values (h, 'Test person', 'sky') returning id into b; end if;
  insert into ovie.devices (household_id, user_id, member_id, kind, label) values (h, pc, a, 'personal', 'Test phone');
  -- a wish made 4 days ago, for the "missed" check
  insert into ovie.wishes (household_id, from_member, to_member, wish, created_at, due_at)
  values (h, b, a, 'Old wish', now() - interval '4 days', now() - interval '1 day') returning id into w2;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. make a wish: 3 days to grant it, shows in What's new
  insert into ovie.wishes (household_id, from_member, to_member, wish) values (h, a, b, 'Breakfast in bed') returning id into w;
  select count(*) into n from ovie.wishes where id = w and due_at > now() + interval '71 hours';
  if n <> 1 then raise exception 'FAIL 1: not due in 3 days'; end if;
  select count(*) into n from ovie.activity where kind = 'wish' and action = 'added' and ref_id = w;
  if n <> 1 then raise exception 'FAIL 1: not in What''s new'; end if;
  passed := passed + 1;

  -- 2. no wishing on yourself, no blank wish, no picking your own deadline
  begin insert into ovie.wishes (household_id, from_member, to_member, wish) values (h, a, a, 'x'); raise exception 'FAIL 2: self';
  exception when check_violation then null; end;
  begin insert into ovie.wishes (household_id, from_member, to_member, wish) values (h, a, b, ' '); raise exception 'FAIL 2: blank';
  exception when check_violation then null; end;
  begin insert into ovie.wishes (household_id, from_member, to_member, wish, due_at) values (h, a, b, 'x', now() + interval '30 days'); raise exception 'FAIL 2: deadline';
  exception when insufficient_privilege then null; end;
  passed := passed + 1;

  -- 3. granted: the wisher pays 3, one What's new line (not two)
  update ovie.wishes set granted_at = now() where id = w;
  select count(*) into n from ovie.meter_points where wish_id = w and to_member = a and points = -3;
  if n <> 1 then raise exception 'FAIL 3: wisher not charged'; end if;
  select count(*) into n from ovie.activity a2 join ovie.meter_points p on p.id = a2.ref_id where p.wish_id = w;
  if n <> 0 then raise exception 'FAIL 3: extra points line'; end if;
  select count(*) into n from ovie.activity where kind = 'wish' and action = 'done' and ref_id = w;
  if n <> 1 then raise exception 'FAIL 3: grant not in What''s new'; end if;
  passed := passed + 1;

  -- 4. granted is final: it can't be un-granted (the points stay)
  update ovie.wishes set granted_at = null where id = w;
  select count(*) into n from ovie.meter_points where wish_id = w;
  if n <> 1 then raise exception 'FAIL 4: un-granted'; end if;
  passed := passed + 1;

  -- 5. people can't mark a wish missed (or change it)
  begin
    update ovie.wishes set missed_at = now() where id = w2;
    raise exception 'FAIL 5: missed_at changed by a person';
  exception when insufficient_privilege then null; end;
  passed := passed + 1;

  -- 6. the clock: 3 days up and not granted -> the other person loses 3
  perform set_config('role', 'postgres', true);
  perform ovie.settle_wishes();
  select count(*) into n from ovie.meter_points where wish_id = w2 and to_member = a and points = -3;
  if n <> 1 then raise exception 'FAIL 6: missed wish not charged'; end if;
  select count(*) into n from ovie.activity where kind = 'wish' and action = 'missed' and ref_id = w2;
  if n <> 1 then raise exception 'FAIL 6: missed not in What''s new'; end if;
  select count(*) into n from ovie.wishes where id = w and missed_at is null and granted_at is not null;
  if n <> 1 then raise exception 'FAIL 6: a granted wish was settled'; end if;
  passed := passed + 1;
  raise exception 'OVIE TESTS PASSED: % checks', passed;
end
$test$;
