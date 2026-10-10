-- Ovie: notes, photos (private storage bucket ovie-photos), alarms, and a read-only
-- monthly trend of ₲ryd's house money for charts.
-- Touches only the `ovie` schema, plus the `ovie-photos` storage bucket and its policies
-- (allowed by docs/KICKOFF.md: buckets prefixed ovie-). ₲ryd tables are only READ.

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table ovie.notes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  body          text not null check (length(btrim(body)) between 1 and 1000),
  from_member   uuid references ovie.members(id) on delete set null,
  to_member     uuid references ovie.members(id) on delete set null, -- null = everyone
  colour        text not null default 'sand' check (colour in ('sand', 'sage', 'sky', 'clay', 'plum')),
  pinned        boolean not null default false,
  done_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notes_household_idx on ovie.notes (household_id, done_at, created_at desc);

-- ---------------------------------------------------------------------------
-- Photos (files live in storage bucket ovie-photos under <household_id>/...)
-- ---------------------------------------------------------------------------
create table ovie.photos (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references ovie.households(id) on delete cascade,
  path          text not null unique check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  caption       text check (length(caption) <= 120),
  width         integer check (width between 1 and 10000),
  height        integer check (height between 1 and 10000),
  uploaded_by   uuid references ovie.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (split_part(path, '/', 1) = household_id::text)
);
create index photos_household_idx on ovie.photos (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Alarms
-- ---------------------------------------------------------------------------
create table ovie.alarms (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references ovie.households(id) on delete cascade,
  label              text not null check (length(btrim(label)) between 1 and 60),
  at_time            time not null,
  days               smallint[] not null default '{}', -- 0 = Sunday … 6 = Saturday; empty = once
  on_date            date,                             -- the day for a one-off alarm
  member_id          uuid references ovie.members(id) on delete set null, -- null = everyone
  enabled            boolean not null default true,
  last_dismissed_for timestamptz, -- the occurrence that was stopped (stops it on every screen)
  snoozed_until      timestamptz,
  created_by         uuid references ovie.members(id) on delete set null,
  created_at         timestamptz not null default now(),
  check (cardinality(days) > 0 or on_date is not null),
  check (cardinality(days) <= 7),
  check (6 >= all (days) and 0 <= all (days))
);
create index alarms_household_idx on ovie.alarms (household_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table ovie.notes enable row level security;
alter table ovie.photos enable row level security;
alter table ovie.alarms enable row level security;

create policy notes_select on ovie.notes for select to authenticated using (ovie.is_member(household_id));
create policy notes_insert on ovie.notes for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, from_member) and ovie.member_in(household_id, to_member));
create policy notes_update on ovie.notes for update to authenticated using (ovie.is_member(household_id)) with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, from_member) and ovie.member_in(household_id, to_member));
create policy notes_delete on ovie.notes for delete to authenticated using (ovie.is_member(household_id));

create policy photos_select on ovie.photos for select to authenticated using (ovie.is_member(household_id));
create policy photos_insert on ovie.photos for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, uploaded_by));
create policy photos_update on ovie.photos for update to authenticated using (ovie.is_member(household_id)) with check (ovie.is_member(household_id));
create policy photos_delete on ovie.photos for delete to authenticated using (ovie.is_member(household_id));

create policy alarms_select on ovie.alarms for select to authenticated using (ovie.is_member(household_id));
create policy alarms_insert on ovie.alarms for insert to authenticated with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id) and ovie.member_in(household_id, created_by));
create policy alarms_update on ovie.alarms for update to authenticated using (ovie.is_member(household_id)) with check (
  ovie.is_member(household_id) and ovie.member_in(household_id, member_id));
create policy alarms_delete on ovie.alarms for delete to authenticated using (ovie.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, 5 MB per file, images only; folder = household id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ovie-photos', 'ovie-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Is this storage path inside a household the caller is paired to?
create or replace function ovie.photo_path_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and ovie.is_member(split_part(p_name, '/', 1)::uuid);
$$;

create policy "ovie photos: paired devices read" on storage.objects for select to authenticated
  using (bucket_id = 'ovie-photos' and ovie.photo_path_allowed(name));
create policy "ovie photos: paired devices upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ovie-photos' and ovie.photo_path_allowed(name));
create policy "ovie photos: paired devices delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ovie-photos' and ovie.photo_path_allowed(name));

-- ---------------------------------------------------------------------------
-- Finance trend: house spending by category and money paid in, per month (read-only).
-- ---------------------------------------------------------------------------
create or replace function ovie.casa_trend(p_months integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_months integer := least(greatest(coalesce(p_months, 6), 1), 24);
  v_from date := (date_trunc('month', current_date) - make_interval(months => v_months - 1))::date;
begin
  if not exists (select 1 from ovie.devices where user_id = (select auth.uid())) then
    raise exception 'not paired' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', m.month,
      'spent', (
        select coalesce(jsonb_agg(jsonb_build_object('group', s.grp, 'total', s.total) order by s.grp), '[]'::jsonb)
        from (select t.grp, -sum(t.amount) as total from public.house_tx t
              where t.direction = 'OUT' and not coalesce(t.excluded, false)
                and t.tx_date >= m.month and t.tx_date < (m.month + interval '1 month')
              group by t.grp) s),
      'paid_in', (
        select coalesce(jsonb_agg(jsonb_build_object('group', s.grp, 'total', s.total) order by s.grp), '[]'::jsonb)
        from (select t.grp, sum(t.amount) as total from public.house_tx t
              where t.direction = 'IN' and not coalesce(t.excluded, false)
                and t.tx_date >= m.month and t.tx_date < (m.month + interval '1 month')
              group by t.grp) s)
    ) order by m.month), '[]'::jsonb)
    from (select generate_series(v_from, date_trunc('month', current_date)::date, interval '1 month')::date as month) m
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants and realtime
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on ovie.notes, ovie.photos, ovie.alarms to authenticated;
grant all on ovie.notes, ovie.photos, ovie.alarms to service_role;

revoke execute on all functions in schema ovie from public, anon;
grant execute on function
  ovie.is_member(uuid),
  ovie.member_in(uuid, uuid),
  ovie.household_today(uuid),
  ovie.setup_state(),
  ovie.setup_household(text, text, text, text),
  ovie.people_for_code(text),
  ovie.pair_device(text, text, uuid, text),
  ovie.regenerate_invite_code(uuid),
  ovie.touch_device(),
  ovie.complete_task(uuid, uuid),
  ovie.uncomplete_task(uuid),
  ovie.casa_summary(date),
  ovie.casa_trend(integer),
  ovie.photo_path_allowed(text)
to authenticated;

alter publication supabase_realtime add table ovie.notes, ovie.photos, ovie.alarms;
