-- Oviemeter: points with a reason, to someone else, shown in What's new. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …".
do $test$
declare
  pc uuid := gen_random_uuid(); h uuid; a uuid; b uuid; p uuid; n int; passed int := 0;
begin
  insert into auth.users (id, email, aud, role) values (pc, null, 'authenticated', 'authenticated');
  select id into h from ovie.households limit 1;
  select id into a from ovie.members where household_id = h order by created_at limit 1;
  select id into b from ovie.members where household_id = h and id <> a order by created_at limit 1;
  if b is null then insert into ovie.members (household_id, display_name, colour) values (h, 'Test person', 'sky') returning id into b; end if;
  insert into ovie.devices (household_id, user_id, member_id, kind, label) values (h, pc, a, 'personal', 'Test phone');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. give points with a reason; it shows in What's new
  insert into ovie.meter_points (household_id, to_member, from_member, points, reason) values (h, b, a, 3, 'Cooked dinner') returning id into p;
  select count(*) into n from ovie.activity where kind = 'meter' and ref_id = p and title = 'Cooked dinner' and (info->>'points')::int = 3;
  if n <> 1 then raise exception 'FAIL 1: not in What''s new'; end if;
  passed := passed + 1;

  -- 2. a reason is needed
  begin
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason) values (h, b, a, -1, '  ');
    raise exception 'FAIL 2: no reason accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 3. no scoring yourself, no zero, at most 10 at once
  begin
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason) values (h, a, a, 1, 'Me');
    raise exception 'FAIL 3: self-scoring accepted';
  exception when check_violation then null;
  end;
  begin
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason) values (h, b, a, 11, 'Too many');
    raise exception 'FAIL 3: 11 points accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 4. not someone from another household
  begin
    insert into ovie.meter_points (household_id, to_member, from_member, points, reason) values (h, gen_random_uuid(), a, 1, 'x');
    raise exception 'FAIL 4: stranger accepted';
  exception when insufficient_privilege or foreign_key_violation then null;
  end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % checks', passed;
end
$test$;
