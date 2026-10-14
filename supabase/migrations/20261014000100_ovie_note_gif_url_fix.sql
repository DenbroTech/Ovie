-- Postgres caps regex repeat counts at 255: check the GIF link's length separately.
alter table ovie.notes drop constraint notes_gif_url_check;
alter table ovie.notes add constraint notes_gif_url_check check (
  gif_url is null or (length(gif_url) <= 400
    and gif_url ~ '^https://(media[0-9]?\.giphy\.com|i\.giphy\.com|static\.klipy\.com)/[A-Za-z0-9._~/%=?&-]+$'));
