#!/bin/bash
# Run interactively on the merchant's Mac. Uses pg_dump's hidden password prompt.
set +x
set -euo pipefail
umask 077

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [[ $# -ne 2 ]]; then
  printf 'Usage: /bin/bash %s "/path/to/Supabase CA certificate" "/path/to/private encrypted backup folder"\n' "$0" >&2
  exit 2
fi

postgres_bin='/Applications/Postgres.app/Contents/Versions/latest/bin'
if [[ -x "$postgres_bin/pg_dump" && -x "$postgres_bin/pg_restore" ]]; then
  pg_dump="$postgres_bin/pg_dump"
  pg_restore="$postgres_bin/pg_restore"
else
  pg_dump="$(command -v pg_dump || true)"
  pg_restore="$(command -v pg_restore || true)"
fi
[[ -n "$pg_dump" && -n "$pg_restore" ]] || fail 'Install Postgres.app or an up-to-date PostgreSQL client first.'
[[ -t 0 && -t 2 ]] || fail 'Open macOS Terminal and run this script there for the hidden prompts.'

[[ -f "$1" && -r "$1" ]] || fail 'The Supabase CA certificate could not be read.'
[[ -d "$2" && -w "$2" ]] || fail 'Choose an existing writable folder on a private encrypted disk.'
certificate="$(cd "$(dirname "$1")" && pwd -P)/$(basename "$1")"
backup_root="$(cd "$2" && pwd -P)"

IFS= read -r -s -p 'Paste the production Session pooler Host (hostname only): ' pooler_host
printf '\n' >&2
IFS= read -r -s -p 'Paste the production Session pooler User: ' pooler_user
printf '\n' >&2

[[ "$pooler_host" =~ ^[a-z0-9.-]+\.pooler\.supabase\.com$ ]] ||
  fail 'Use the Host field under Session pooler → View parameters.'
[[ "$pooler_user" =~ ^postgres\.[a-z0-9]+$ ]] ||
  fail 'Use the database owner User field under Session pooler → View parameters.'

backup_dir="$(mktemp -d "$backup_root/omans-supabase-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")"
partial="$backup_dir/database.dump.partial"
archive="$backup_dir/database.dump"
toc="$backup_dir/.contents"

cleanup() {
  rm -f -- "$partial" "$toc"
  if [[ ! -f "$archive" ]]; then rmdir -- "$backup_dir" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Enter the Supabase database password when prompted. Terminal hides the characters.\n'
if diagnostic="$(
  unset PGPASSWORD PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS PGSSLCERT PGSSLKEY PGSSLPASSWORD PGSSLCRL PGSSLCRLDIR
  export PGHOST="$pooler_host" PGUSER="$pooler_user" PGPORT=5432 PGDATABASE=postgres
  export PGSSLMODE=verify-full PGSSLROOTCERT="$certificate" PGGSSENCMODE=disable
  export PGPASSFILE=/dev/null PGCONNECT_TIMEOUT=15 LC_ALL=C
  "$pg_dump" --password --format=custom --lock-wait-timeout=10s --file="$partial" 2>&1
)"; then
  unset diagnostic
else
  case "$diagnostic" in
    *'server version mismatch'*) reason='The installed PostgreSQL client is older than the server.' ;;
    *'password authentication failed'*|*'Tenant or user not found'*) reason='Check the Session pooler User and database password.' ;;
    *'certificate'*|*'SSL'*) reason='Check the Supabase CA certificate and Session pooler Host.' ;;
    *'permission denied'*|*'row-level security'*) reason='The database role could not read every object in the full dump.' ;;
    *'lock timeout'*|*'canceling statement due to lock timeout'*) reason='The backup encountered a database lock. Retry when the store is quiet.' ;;
    *) reason='Check that the database is reachable and the backup folder has enough space.' ;;
  esac
  unset diagnostic
  fail "Backup failed. $reason"
fi

"$pg_restore" --list "$partial" >"$toc" 2>/dev/null ||
  fail 'The archive could not be listed.'
for table in products orders brand_settings; do
  grep -Eq " TABLE DATA public $table " "$toc" ||
    fail "The archive is missing the expected public.$table table data entry."
done
"$pg_restore" --exit-on-error --file=/dev/null "$partial" >/dev/null 2>&1 ||
  fail 'The archive could not be read from start to finish.'

mv -- "$partial" "$archive"
printf 'Backup saved to %s\n' "$archive"
printf 'The archive was read successfully and includes the three storefront data tables.\n'
