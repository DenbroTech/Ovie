-- A tiny stand-in for the parts of Supabase that Ovie's migrations rely on,
-- so migrations, SQL tests and backup/restore can be exercised on a throwaway local Postgres.
-- NEVER run this against the real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

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

-- Pretend ₲ryd: a public table with an audit trigger, to prove Ovie never touches it.
create table public.house_tx (id serial primary key, amount numeric, merchant text);
insert into public.house_tx (amount, merchant) values (-231.44, 'Woolies'), (-1420, 'rent');
create table public.audit_log (id serial primary key, at timestamptz default now(), what text);
create function public.log_change() returns trigger language plpgsql as $$
begin insert into public.audit_log(what) values (tg_op || ' ' || tg_table_name); return null; end $$;
create trigger house_tx_audit after insert or update or delete on public.house_tx
  for each row execute function public.log_change();
