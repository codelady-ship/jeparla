#!/usr/bin/env bash
# Restore test of a backup (#56): restores into a throwaway PostgreSQL 16 container, never into the live
# database, checks it and prints one line for the restore log in docs/operations.md.
#
#   docker/backup/pg-restore-test.sh                 # the newest backup in R2
#   docker/backup/pg-restore-test.sh <object-key>    # a given one, e.g. postgres/jeparla-2026-11-14T020000Z.dump.gpg
#
# Same environment as pg-backup.sh. Needs docker, gpg and the aws CLI. The container and the decrypted dump
# are removed at the end, also on failure.
set -euo pipefail

: "${BACKUP_PASSPHRASE_FILE:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ENDPOINT:?}"
: "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
prefix="${BACKUP_PREFIX:-postgres/}"
export AWS_DEFAULT_REGION=auto
s3() { aws s3 --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"; }

key="${1:-}"
if [ -z "$key" ]; then
  # Names sort by their UTC timestamp.
  key="${prefix}$(s3 ls "s3://${BACKUP_S3_BUCKET}/${prefix}" | awk '{print $4}' | grep '^jeparla-.*\.dump\.gpg$' | sort | tail -n 1)"
fi
[ "$key" != "$prefix" ] || { echo "no backup found under s3://${BACKUP_S3_BUCKET}/${prefix}" >&2; exit 1; }

work="$(mktemp -d)"
container="jeparla-restore-test-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

started="$(date -u +%s)"
s3 cp --only-show-errors "s3://${BACKUP_S3_BUCKET}/${key}" "$work/backup.gpg"
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
    --decrypt --output "$work/backup.dump" "$work/backup.gpg"

# A random password for a container that listens on no port and lives for this test only.
docker run -d --name "$container" -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" -e POSTGRES_DB=restore \
  -v "$work:/backup:ro" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d restore >/dev/null 2>&1 && break
  sleep 1
done

docker exec "$container" pg_restore -U postgres -d restore --no-owner --no-acl --exit-on-error /backup/backup.dump

q() { docker exec "$container" psql -U postgres -d restore -tAc "$1"; }
version="$(q "SELECT max(version::int) FROM flyway_schema_history WHERE success")"
tables="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
users="$(q "SELECT count(*) FROM users")"
stores="$(q "SELECT count(*) FROM stores")"
products="$(q "SELECT count(*) FROM products")"
[ -n "$version" ] && [ "$tables" -gt 0 ] || { echo "restore check failed: version=$version tables=$tables" >&2; exit 1; }

seconds=$(( $(date -u +%s) - started ))
echo "| $(date -u +%Y-%m-%d) | ${key} | V${version}, ${tables} tables, users=${users}, stores=${stores}, products=${products} | ${seconds} s | OK |"
