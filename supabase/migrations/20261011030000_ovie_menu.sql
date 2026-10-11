-- Ovie: the Menu. Saved meals (e.g. "Pizza night"), planned onto days. A planned meal is an ordinary
-- calendar event with meal_id set, so it shows everywhere events do. Touches only the ovie schema;
-- the events change is add-only (one optional column, an index and a guard trigger).

create table ovie.meals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 60),
  emoji         text check (length(emoji) <= 16),
  notes         text check (length(notes) <= 500),
  created_by    uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index meals_household_idx on ovie.meals (household_id, name);
create index meals_created_by_idx on ovie.meals (created_by);

alter table ovie.events add column meal_id uuid references ovie.meals(id) on delete cascade;
create index events_meal_idx on ovie.events (meal_id) where meal_id is not null;

-- A planned meal must be one of this household's meals.
create or replace function ovie.events_meal_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.meal_id is not null
     and not exists (select 1 from ovie.meals m where m.id = new.meal_id and m.household_id = new.household_id) then
    raise exception 'that meal is not in this household' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger events_meal_guard before insert or update of meal_id, household_id on ovie.events
  for each row execute function ovie.events_meal_guard();

alter table ovie.meals enable row level security;
create policy meals_select on ovie.meals for select to authenticated using (ovie.is_member(household_id));
create policy meals_insert on ovie.meals for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, created_by));
create policy meals_update on ovie.meals for update to authenticated using (ovie.is_member(household_id)) with check (ovie.is_member(household_id));
create policy meals_delete on ovie.meals for delete to authenticated using (ovie.is_member(household_id));

grant select, insert, update, delete on ovie.meals to authenticated;
grant all on ovie.meals to service_role;
revoke execute on function ovie.events_meal_guard() from public, anon, authenticated;

alter publication supabase_realtime add table ovie.meals;
