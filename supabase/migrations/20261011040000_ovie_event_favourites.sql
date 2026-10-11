-- Ovie: starred calendar entries ("Working at Harvey's") that keep everything but the date, with saved
-- times (e.g. two shifts) so they can be put on many days quickly. Add-only, ovie schema only.
-- times: [{ "label": "Early", "from": "07:00", "to": "15:00" }, …] (empty for all-day favourites)
create table ovie.event_favourites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 120),
  notes         text check (length(notes) <= 1000),
  location      text check (length(location) <= 120),
  member_id     uuid references ovie.members(id) on delete set null, -- null = everyone
  all_day       boolean not null default false,
  times         jsonb not null default '[]' check (jsonb_typeof(times) = 'array' and jsonb_array_length(times) <= 8),
  created_by    uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index event_favourites_household_idx on ovie.event_favourites (household_id, title);
create index event_favourites_member_idx on ovie.event_favourites (member_id);
create index event_favourites_created_by_idx on ovie.event_favourites (created_by);

alter table ovie.event_favourites enable row level security;
create policy event_favourites_select on ovie.event_favourites for select to authenticated using (ovie.is_member(household_id));
create policy event_favourites_insert on ovie.event_favourites for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id) and ovie.member_in(household_id, created_by));
create policy event_favourites_update on ovie.event_favourites for update to authenticated using (ovie.is_member(household_id)) with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id));
create policy event_favourites_delete on ovie.event_favourites for delete to authenticated using (ovie.is_member(household_id));

grant select, insert, update, delete on ovie.event_favourites to authenticated;
grant all on ovie.event_favourites to service_role;

alter publication supabase_realtime add table ovie.event_favourites;
