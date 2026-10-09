#!/usr/bin/env bash
# Backup -> damage -> restore cycle on a throwaway local Postgres prepared by run.sh.
# Uses the same pg_dump / pg_restore flags and the same guard as scripts\*.cmd.
set -euo pipefail
DB="$1"; ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; TMP="$(mktemp -d)"
q(){ psql "$DB" -qAtc "$1"; }
q "insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','a@x') on conflict do nothing"
q "insert into ovie.households(id,name) values ('22222222-2222-2222-2222-222222222222','Home') on conflict do nothing"
q "insert into ovie.members(household_id,user_id,display_name,role) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Andrew','owner') on conflict do nothing"
before="$(q "select count(*) from ovie.members")|$(q "select name from ovie.households")|$(q "select count(*) from public.house_tx")|$(q "select count(*) from public.audit_log")"
pg_dump "$DB" --schema=ovie --format=custom --no-owner --file "$TMP/b.dump"
q "delete from ovie.members; update ovie.households set name='BROKEN'"
if pg_restore --list "$TMP/b.dump" | grep -v '^;' | grep '[^ ]' | grep -qv ' ovie '; then echo "FAIL guard rejected a clean dump"; exit 1; fi
pg_restore --dbname "$DB" --clean --if-exists --no-owner --single-transaction --exit-on-error "$TMP/b.dump"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/restore-fixups.sql"
after="$(q "select count(*) from ovie.members")|$(q "select name from ovie.households")|$(q "select count(*) from public.house_tx")|$(q "select count(*) from public.audit_log")"
[ "$before" = "$after" ] || { echo "FAIL before=$before after=$after"; exit 1; }
[ "$(q "select count(*) from pg_publication_tables where schemaname='ovie'")" -ge 2 ] || { echo "FAIL realtime not restored"; exit 1; }
pg_dump "$DB" --format=custom --no-owner --file "$TMP/all.dump"
pg_restore --list "$TMP/all.dump" | grep -v '^;' | grep '[^ ]' | grep -qv ' ovie ' || { echo "FAIL guard accepted a dump with other schemas"; exit 1; }
echo "PASS backup/restore: data restored ($after), public untouched, realtime restored, guard works"
rm -rf "$TMP"
