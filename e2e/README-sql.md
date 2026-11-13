# SQL verification (Layer 2)

`bash e2e/sql/run.sh` spins up (or reuses) a throwaway Postgres 16 cluster, recreates database `epd_sql_test`,
applies `bootstrap.sql` (Supabase stand-ins: roles, `auth`, `storage`, `supabase_realtime`), applies every
`supabase/migrations/*.sql` in order **twice** (idempotency), then runs `e2e/sql/tests/*.sql`.
Each assertion prints `PASS|FAIL <name>`; `UNTESTED` marks skipped areas. Exit code 0 = all green.

Env: `PGHOME` (cluster dir, default `$TMPDIR/epd-pg16`), `PGPORT` (54329), `PGBIN`, `PGSOCK` (short socket dir,
default `/tmp/epd-pg-sock`), `DB`. Runs as `postgres` via `runuser` when invoked as root. Never touches a remote DB.
Stop the cluster: `runuser -u postgres -- $PGBIN/pg_ctl -D $PGHOME/data stop`.

Tests: 10 pipeline foundation, 20 relations/owners, 30 automation (incl. real two-session `skip locked` test),
40 RLS (open + workspace mode, roles, storage), 50 saved views / buckets / pgvector (UNTESTED if the extension is absent).
