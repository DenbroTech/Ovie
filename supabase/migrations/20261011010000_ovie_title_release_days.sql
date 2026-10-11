-- Ovie: shows that release on more than one day a week (e.g. The Traitors: Thursday and Friday).
-- Add-only. With release_pace = 'weekly', episodes after release_episode come out on these weekdays
-- (0 = Sunday … 6 = Saturday); empty = the same weekday as release_on.
alter table ovie.titles
  add column release_days smallint[] not null default '{}',
  add constraint titles_release_days_valid check (cardinality(release_days) <= 7 and 0 <= all (release_days) and 6 >= all (release_days));
