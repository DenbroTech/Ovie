-- Ovie: when the next episode (or a film) comes out, so Watch never suggests something that isn't out yet.
-- Add-only change to ovie.titles (all new columns optional). Touches nothing outside the ovie schema.
--   release_on       the date it comes out (film: the film; show: release_season/release_episode)
--   release_pace     after that episode: 'all' = the rest of the season drops the same day, 'weekly' = one a week
alter table ovie.titles
  add column release_season  smallint check (release_season between 1 and 60),
  add column release_episode smallint check (release_episode between 1 and 500),
  add column release_on      date,
  add column release_pace    text not null default 'all' check (release_pace in ('all', 'weekly')),
  add constraint titles_release_episode_pair check ((release_season is null) = (release_episode is null)),
  add constraint titles_release_needs_date check (release_season is null or release_on is not null),
  add constraint titles_release_show_only check (kind = 'show' or release_season is null);
