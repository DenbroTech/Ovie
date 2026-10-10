set client_min_messages = warning;
-- Run automatically by restore-ovie.cmd BEFORE pg_restore.
-- The photo permissions on storage.objects depend on ovie.photo_path_allowed(), which the
-- restore replaces, so set them aside first. restore-fixups.sql puts them back.
drop policy if exists "ovie photos: paired devices read" on storage.objects;
drop policy if exists "ovie photos: paired devices upload" on storage.objects;
drop policy if exists "ovie photos: paired devices delete" on storage.objects;
