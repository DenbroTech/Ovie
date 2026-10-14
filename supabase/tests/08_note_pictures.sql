-- Notes with a picture, a GIF and a drawing. ALWAYS rolls back.
-- Expected outcome: ERROR "OVIE TESTS PASSED: …".
do $test$
declare
  pc uuid := gen_random_uuid(); h uuid; andrew uuid; n int; passed int := 0;
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
  select id into andrew from ovie.members where household_id = h order by created_at limit 1;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);

  -- 1. a note can be just a picture, just a GIF or just a drawing (no words)
  insert into ovie.notes (household_id, body, from_member, image_path) values (h, '', andrew, h::text || '/notes/abc.jpg');
  insert into ovie.notes (household_id, body, from_member, gif_url) values (h, '', andrew, 'https://media1.giphy.com/media/xyz/giphy.gif');
  insert into ovie.notes (household_id, body, from_member, doodle) values (h, ' ', andrew, '{"v":1,"items":[]}');
  select count(*) into n from ovie.notes where household_id = h and from_member = andrew and length(btrim(body)) = 0;
  if n < 3 then raise exception 'FAIL 1: picture-only notes'; end if;
  passed := passed + 1;

  -- 2. an empty note is refused
  begin
    insert into ovie.notes (household_id, body) values (h, '  ');
    raise exception 'FAIL 2: empty note accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 3. pictures must sit in this household's notes folder
  begin
    insert into ovie.notes (household_id, body, image_path) values (h, 'x', gen_random_uuid()::text || '/notes/a.jpg');
    raise exception 'FAIL 3: picture in another household accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 4. GIFs only from GIPHY / KLIPY media
  begin
    insert into ovie.notes (household_id, body, gif_url) values (h, 'x', 'https://evil.example.com/a.gif');
    raise exception 'FAIL 4: GIF from anywhere accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 5. a drawing must be an object
  begin
    insert into ovie.notes (household_id, body, doodle) values (h, 'x', '[1,2]');
    raise exception 'FAIL 5: drawing that is not an object accepted';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  raise exception 'OVIE TESTS PASSED: % checks', passed;
end
$test$;
