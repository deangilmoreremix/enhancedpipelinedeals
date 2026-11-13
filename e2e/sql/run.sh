#!/usr/bin/env bash
# Layer-2 SQL verification on a throwaway local Postgres 16. Usage: bash e2e/sql/run.sh
# Env: PGBIN (default /usr/lib/postgresql/16/bin), PGHOME (cluster dir), PGPORT (54329), DB.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGHOME="${PGHOME:-${TMPDIR:-/tmp}/epd-pg16}"
PGPORT="${PGPORT:-54329}"
DB="${DB:-epd_sql_test}"
SOCK="${PGSOCK:-/tmp/epd-pg-sock}"
RUN=""
mkdir -p "$PGHOME"
if [ "$(id -u)" = "0" ]; then
  RUN="runuser -u postgres --"
  chown postgres "$PGHOME"
  d="$PGHOME"; while [ "$d" != "/" ]; do chmod o+x "$d" 2>/dev/null; d="$(dirname "$d")"; done
fi
if [ ! -f "$PGHOME/data/PG_VERSION" ]; then
  $RUN "$PGBIN/initdb" -D "$PGHOME/data" -A trust -U postgres >/dev/null || exit 2
fi
mkdir -p "$SOCK"; [ -n "$RUN" ] && chown postgres "$SOCK"
if ! $RUN "$PGBIN/pg_ctl" -D "$PGHOME/data" status >/dev/null 2>&1; then
  $RUN "$PGBIN/pg_ctl" -D "$PGHOME/data" -l "$PGHOME/pg.log" -w \
    -o "-p $PGPORT -k $SOCK -c listen_addresses='' -c wal_level=logical -c fsync=off -c synchronous_commit=off -c full_page_writes=off" start >/dev/null || { cat "$PGHOME/pg.log"; exit 2; }
fi
PSQL=(psql -X -q -h "$SOCK" -p "$PGPORT" -U postgres)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" || exit 2
P=("${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=1)
"${P[@]}" -f "$HERE/bootstrap.sql" || { echo "BOOTSTRAP FAILED"; exit 2; }
fail=0
for pass in 1 2; do
  echo "== migrations pass $pass =="
  for f in "$ROOT"/supabase/migrations/*.sql; do
    out=$("${P[@]}" -f "$f" 2>&1); rc=$?
    if [ $rc -ne 0 ]; then echo "FAIL  pass$pass  $(basename "$f")"; echo "$out" | grep -i -E "error|detail|hint|context|line" | head -8; fail=1; break 2
    else echo "ok    pass$pass  $(basename "$f")"; echo "$out" | grep -i "notice\|warning" | grep -v "already exists, skipping\|does not exist, skipping" | head -3 | sed 's/^/      /'; fi
  done
done
[ $fail -ne 0 ] && { echo "MIGRATIONS FAILED"; exit 1; }
echo "== tests =="
tot=0; bad=0
export E2E_MIGDIR="$ROOT/supabase/migrations" E2E_TMP="$PGHOME/tmp" PGHOST="$SOCK" PGPORT="$PGPORT" PGUSER=postgres PGDATABASE="$DB"
mkdir -p "$E2E_TMP"; [ -n "$RUN" ] && chmod 777 "$E2E_TMP"
for t in "$HERE"/tests/*.sql; do
  [ -f "$t" ] || continue
  echo "-- $(basename "$t")"
  out=$("${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=1 -At -f "$t" 2>&1); rc=$?
  echo "$out" | grep -E "^(PASS|FAIL|UNTESTED)" | sed 's/^/  /'
  p=$(echo "$out" | grep -c "^PASS"); f=$(echo "$out" | grep -c "^FAIL")
  tot=$((tot+p+f)); bad=$((bad+f))
  if [ $rc -ne 0 ]; then echo "  SCRIPT ERROR:"; echo "$out" | grep -v -E "^(PASS|FAIL|UNTESTED)" | tail -8 | sed 's/^/    /'; bad=$((bad+1)); fi
done
# contract schema for the strict fake Supabase / endpoint audit (tables->columns, RPC signatures, policies per role/op)
if "${PSQL[@]}" -d "$DB" -At -f "$HERE/emit-schema.sql" > "$PGHOME/tmp/schema.json" 2>"$PGHOME/tmp/schema.err" && [ -s "$PGHOME/tmp/schema.json" ]; then
  mkdir -p "$ROOT/e2e/lib"; cp "$PGHOME/tmp/schema.json" "$ROOT/e2e/lib/schema.json"; echo "schema: wrote e2e/lib/schema.json"
else echo "schema: FAILED to emit"; cat "$PGHOME/tmp/schema.err"; bad=$((bad+1)); fi
echo "== summary: $tot assertions, $bad failures =="
[ $bad -eq 0 ]
