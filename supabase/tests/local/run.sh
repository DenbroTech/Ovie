#!/usr/bin/env bash
# Runs every migration + SQL test against a throwaway local Postgres (NOT Supabase).
# Usage: supabase/tests/local/run.sh "<connection string of an EMPTY local database>"
set -euo pipefail
DB="$1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  psql "$DB" -q -v ON_ERROR_STOP=1 -f "$f"
done
fail=0
for t in "$ROOT"/supabase/tests/*.sql; do
  out="$(psql "$DB" -q -f "$t" 2>&1 || true)"
  if grep -q 'OVIE TESTS PASSED' <<<"$out"; then
    echo "PASS $(basename "$t"): $(grep -o 'OVIE TESTS PASSED[^(]*' <<<"$out")"
  else
    echo "FAIL $(basename "$t")"; echo "$out"; fail=1
  fi
done
exit $fail
