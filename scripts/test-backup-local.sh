#!/usr/bin/env bash
# Round-trips the ovie-only backup/restore (same pg_dump/psql commands as the
# Windows scripts) on a throwaway local Postgres, and checks `public` is untouched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"; PORT=54330
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
RUNAS=(); if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
URL="postgresql://postgres@/postgres?host=$WORK&port=$PORT"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 "$URL")
"${PSQL[@]}" -f "$ROOT/supabase/tests/_local_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
# A stand-in for Gryd's data that must survive.
"${PSQL[@]}" -c "create table public.house_tx (id int primary key, amount numeric); insert into public.house_tx values (1, 42);"
"${PSQL[@]}" -c "insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
  set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; select ovie.create_household('Home','Andrew');"

DUMP="$WORK/ovie.sql"
pg_dump --schema=ovie --no-owner --format=plain --file="$DUMP" "$URL"
if grep -Eiq '^(CREATE .* public\.|ALTER .* public\.|DROP .* public\.|COPY public\.|INSERT INTO public\.|TRUNCATE .*public\.)' "$DUMP"; then
  echo "FAIL dump mentions public"; exit 1; fi

# Damage ovie data, then restore exactly as ovie-restore.cmd does.
"${PSQL[@]}" -c "delete from ovie.households; update public.house_tx set amount = 43;"
"${PSQL[@]}" --single-transaction -c "drop schema if exists ovie cascade;" -f "$DUMP" >/dev/null

check() { [ "$("${PSQL[@]}" -tAc "$1")" = "$2" ] || { echo "FAIL: $1 (expected $2)"; exit 1; }; }
check "select name from ovie.households" "Home"
check "select count(*) from ovie.household_members" "1"
check "select amount from public.house_tx where id = 1" "43"   # restore left public alone
check "select relrowsecurity from pg_class where oid = 'ovie.households'::regclass" "t"
check "select has_table_privilege('anon', 'ovie.households', 'select')" "f"
check "select has_table_privilege('authenticated', 'ovie.households', 'select')" "t"
echo "PASS backup/restore round trip (ovie restored, public untouched, RLS and grants intact)"
