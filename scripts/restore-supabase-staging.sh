#!/bin/bash
# Restore and verify the storefront schema in a new socket-only PostgreSQL cluster.
set +x
set -euo pipefail
umask 077
# Keep the original stderr available if Bash runs the exit trap during a logged command.
exec 3>&2

if [[ $# -ne 1 || ! -f "$1" || ! -r "$1" || -L "$1" ]]; then
  printf 'Give this script the path to the readable database.dump file on the encrypted backup disk.\n' >&2
  exit 2
fi

postgres_bin='/Applications/Postgres.app/Contents/Versions/latest/bin'
for command in initdb pg_ctl psql pg_restore; do
  if [[ ! -x "$postgres_bin/$command" ]]; then
    printf 'Postgres.app is missing the required %s tool.\n' "$command" >&2
    exit 2
  fi
done

archive_directory="$(cd "$(dirname "$1")" && pwd -P)"
archive="$archive_directory/$(basename "$1")"
printf 'Preparing a private local storefront restore.\n'
if ! staging="$(mktemp -d "$archive_directory/staging.XXXXXX")"; then
  printf 'Could not create a staging folder beside the backup. Check that the encrypted disk is writable.\n' >&3
  exit 1
fi
data="$staging/data"
diagnostics="$staging/diagnostics.log"
socket=''
starting=false
verified=false
phase='checking the archive'

postgres() {
  local command="$1"
  shift
  /usr/bin/env -i PATH=/usr/bin:/bin LC_ALL=C "$postgres_bin/$command" "$@" 3>&-
}

cleanup() {
  local exit_code=$?
  trap - EXIT
  if [[ "$starting" = true && -f "$data/postmaster.pid" ]]; then
    if ! postgres pg_ctl -D "$data" -m fast -w -t 30 stop >>"$diagnostics" 2>&1; then
      printf 'The local staging server did not stop. Keep the encrypted disk mounted.\n' >&3
      exit 1
    fi
  fi
  if [[ -n "$socket" ]]; then rmdir "$socket" 2>/dev/null || true; fi
  if [[ "$verified" = true ]]; then
    printf 'Storefront restore verified. The local staging server is stopped.\n'
    printf 'Staging folder: %s\n' "$staging"
  else
    printf 'Local staging restore stopped while %s.\n' "$phase" >&3
    printf 'Private diagnostics: %s\n' "$diagnostics" >&3
  fi
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Count the archive's COPY rows without printing or storing their contents.
expected="$(postgres pg_restore --schema=public --data-only --file=- "$archive" 2>>"$diagnostics" | awk '
  /^COPY public\.(products|orders|brand_settings) \(/ {
    if (table != "") exit 1
    table = substr($2, 8)
    copies[table]++
    next
  }
  table != "" && $0 == "\\." { table = ""; next }
  table != "" { rows[table]++ }
  END {
    if (table != "" || copies["products"] != 1 || copies["orders"] != 1 || copies["brand_settings"] != 1) exit 1
    printf "products|%d\norders|%d\nbrand_settings|%d\n", rows["products"], rows["orders"], rows["brand_settings"]
  }
')"

phase='creating the isolated local database'
socket="$(mktemp -d /private/tmp/omans-stage.XXXXXX)"
postgres initdb -D "$data" --username=postgres --auth-local=trust --auth-host=reject \
  --locale=C --encoding=UTF8 >>"$diagnostics" 2>&1
starting=true
postgres pg_ctl -D "$data" -l "$staging/server.log" \
  -o "-c listen_addresses='' -k '$socket' -p 55432" -w -t 30 start >>"$diagnostics" 2>&1
local_connection=(--host="$socket" --port=55432 --username=postgres --no-password)

# pg_dump captures table grants but not cluster roles. These are local stand-ins.
postgres psql -X "${local_connection[@]}" -v ON_ERROR_STOP=1 --dbname=postgres \
  >>"$diagnostics" 2>&1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN;
CREATE DATABASE omans_staging TEMPLATE template0;
SQL

phase='restoring the storefront schema and data'
postgres pg_restore "${local_connection[@]}" --dbname=omans_staging --schema=public \
  --exit-on-error --single-transaction "$archive" >>"$diagnostics" 2>&1

phase='comparing restored row counts with the archive'
actual="$(postgres psql -X -qAt "${local_connection[@]}" -v ON_ERROR_STOP=1 --dbname=omans_staging \
  2>>"$diagnostics" <<'SQL'
SELECT 'products', count(*) FROM public.products;
SELECT 'orders', count(*) FROM public.orders;
SELECT 'brand_settings', count(*) FROM public.brand_settings;
SQL
)"
[[ "$actual" == "$expected" ]]

printf 'Restored row counts match the backup.\n'
printf '%s\n' "$actual" | awk -F '|' '{ printf "%s: %s\n", $1, $2 }'
verified=true
