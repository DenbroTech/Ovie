-- Photo crop for the wall screen. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …". Delete-free.
do $test$
declare
  pc uuid := gen_random_uuid();
  h uuid; p uuid; passed int := 0;
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

  -- 1. a paired device can set and clear a crop
  insert into ovie.photos (household_id, path, width, height) values (h, h::text || '/crop-test.jpg', 1600, 1200) returning id into p;
  update ovie.photos set crop_x = 0.2, crop_y = 0, crop_w = 0.5, crop_h = 1 where id = p;
  if (select crop_w from ovie.photos where id = p) <> 0.5 then raise exception 'FAIL 1: crop not saved'; end if;
  update ovie.photos set crop_x = null, crop_y = null, crop_w = null, crop_h = null where id = p;
  passed := passed + 1;

  -- 2. half a crop, or one that runs off the picture, is refused
  begin
    update ovie.photos set crop_x = 0.2 where id = p;
    raise exception 'FAIL 2: half a crop accepted';
  exception when check_violation then null; end;
  begin
    update ovie.photos set crop_x = 0.8, crop_y = 0, crop_w = 0.5, crop_h = 1 where id = p;
    raise exception 'FAIL 2: crop off the edge accepted';
  exception when check_violation then null; end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % photo-crop checks', passed;
end $test$;
