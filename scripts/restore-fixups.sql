-- Run automatically by restore-ovie.cmd after pg_restore.
-- pg_dump --schema=ovie does not carry these two settings, so put them back.
-- Touches only Ovie's own objects.
alter default privileges in schema ovie revoke execute on functions from public;

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'ovie' and c.relkind = 'r'
      and not exists (
        select 1 from pg_publication_tables p
        where p.pubname = 'supabase_realtime' and p.schemaname = 'ovie' and p.tablename = c.relname)
  loop
    execute format('alter publication supabase_realtime add table ovie.%I', r.relname);
  end loop;
end $$;
