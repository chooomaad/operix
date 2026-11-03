#!/usr/bin/env bash
# Recrée une base de test locale : stubs Supabase + migrations + seed.
# Usage : tests/db_reset.sh   (PostgreSQL 16 local, sans Docker)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-$ROOT/.pgtest/data}"
PGPORT="${PGPORT:-54329}"
DB=operix_test
PGOPTIONS="-p $PGPORT"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) ;;
  *) PGOPTIONS="$PGOPTIONS -k /tmp" ;;
esac

mkdir -p "$(dirname "$PGDATA")"
# PostgreSQL refuse de tourner en root : on passe par l'utilisateur système `postgres`.
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
if [ "$(id -u)" = 0 ]; then chown -R postgres "$(dirname "$PGDATA")"; fi
if [ ! -d "$PGDATA" ]; then
  as_pg "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi
if ! as_pg "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  as_pg "$PGBIN/pg_ctl" -D "$PGDATA" -o "$PGOPTIONS" -l "$(dirname "$PGDATA")/pg.log" start >/dev/null
  sleep 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PGPORT" -U postgres)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f "$ROOT/tests/supabase_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f"
done
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql"
echo "postgres://postgres@127.0.0.1:$PGPORT/$DB"
