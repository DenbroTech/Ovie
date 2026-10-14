-- Ovie: notes can carry a picture (uploaded to ovie-photos under <household>/notes/), a GIF link
-- (GIPHY / KLIPY media only) and a finger drawing (small JSON of strokes and shapes).
-- A note needs at least one of: words, picture, GIF, drawing.
-- Touches only ovie.notes and the ovie-photos bucket row (allowed: buckets prefixed ovie-).

alter table ovie.notes drop constraint notes_body_check;
alter table ovie.notes
  add column image_path text,
  add column gif_url    text,
  add column doodle     jsonb,
  add constraint notes_body_len check (length(body) <= 1000),
  add constraint notes_image_path_check check (
    image_path is null or (
      image_path ~ '^[0-9a-f-]{36}/notes/[A-Za-z0-9._-]{1,80}$'
      and split_part(image_path, '/', 1) = household_id::text)),
  add constraint notes_gif_url_check check (
    gif_url is null or gif_url ~ '^https://(media[0-9]?\.giphy\.com|i\.giphy\.com|static\.klipy\.com)/[A-Za-z0-9._~/%=?&-]{1,400}$'),
  add constraint notes_doodle_check check (
    doodle is null or (jsonb_typeof(doodle) = 'object' and pg_column_size(doodle) <= 150000)),
  add constraint notes_has_something check (
    length(btrim(body)) > 0 or image_path is not null or gif_url is not null or doodle is not null);

-- GIFs from the phone's gallery can be uploaded too.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'ovie-photos';
