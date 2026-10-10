-- A tiny stand-in for the parts of Supabase that Ovie's migrations rely on,
-- so migrations, SQL tests and backup/restore can be exercised on a throwaway local Postgres.
-- NEVER run this against the real project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create extension pgcrypto schema extensions;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  aud text,
  role text
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create publication supabase_realtime;

-- Pretend ₲ryd: house tables shaped like the real ones, plus an audit trigger,
-- to prove Ovie only ever reads them.
create table public.house_people (name text, share numeric, sort_order integer);
insert into public.house_people values ('ANDREW', 0.6667, 1), ('LINA', 0.3333, 2);
create table public.house_tx (
  id uuid primary key default gen_random_uuid(), tx_date date, amount numeric, grp text,
  direction text, merchant text, excluded boolean default false, note text, created_at timestamptz default now());
insert into public.house_tx (tx_date, amount, grp, direction, merchant, excluded) values
  (date_trunc('month', current_date)::date + 1, -231.44, 'Groceries', 'OUT', 'Woolies', false),
  (date_trunc('month', current_date)::date + 2, -1420, 'RENT', 'OUT', 'rent', false),
  (date_trunc('month', current_date)::date + 3, 600, 'LINA', 'IN', null, false),
  (date_trunc('month', current_date)::date + 4, -99, 'SHOP', 'OUT', 'ignored', true),
  (date_trunc('month', current_date)::date - 20, -50, 'BILLS', 'OUT', 'last month', false);
create table public.audit_log (id serial primary key, at timestamptz default now(), what text);
create function public.log_change() returns trigger language plpgsql as $$
begin insert into public.audit_log(what) values (tg_op || ' ' || tg_table_name); return null; end $$;
create trigger house_tx_audit after insert or update or delete on public.house_tx
  for each row execute function public.log_change();

-- Minimal Supabase Storage tables (bucket + object rows) for policy tests.
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
