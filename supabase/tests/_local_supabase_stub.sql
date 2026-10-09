-- Minimal stand-in for the pieces of Supabase that Ovie migrations rely on,
-- so migrations and RLS can be tested in a throwaway local Postgres.
-- NEVER run this against the real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(current_setting('request.jwt.claim.sub', true),
             current_setting('request.jwt.claims', true)::json ->> 'sub'),
    '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
