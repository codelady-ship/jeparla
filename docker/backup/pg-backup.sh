#!/usr/bin/env bash
# Nightly PostgreSQL backup to Cloudflare R2 (#56, PLAN 3a: pg_dump -> R2, 14 days).
#
# Runs on the VM from the repository directory (cron, see docs/operations.md):
#   docker compose exec postgres pg_dump  ->  gpg (symmetric, AES256)  ->  aws s3 cp to R2
#
# The dump holds personal data (accounts, seller documents' metadata, declarations with IP), so it is
# encrypted before it leaves the VM. Keys come from the environment only (never from the repository):
#   BACKUP_PASSPHRASE_FILE   file with the gpg passphrase (chmod 600; keep a copy outside the VM, e.g. a
#                            password manager: without it no backup can be restored)
#   BACKUP_S3_BUCKET         R2 bucket for backups (separate from the image buckets, private)
#   BACKUP_S3_ENDPOINT       https://<account-id>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   an R2 token limited to that bucket
# Optional: JEPARLA_DB_NAME (default jeparla), BACKUP_PREFIX (default postgres/),
#           BACKUP_S3_REGION (default auto, R2; Oracle Object Storage needs its region).
#
# Retention (14 days) is an R2 lifecycle rule on the bucket, not this script: a broken cron never deletes.
set -euo pipefail

: "${BACKUP_PASSPHRASE_FILE:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ENDPOINT:?}"
: "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
db="${JEPARLA_DB_NAME:-jeparla}"
prefix="${BACKUP_PREFIX:-postgres/}"
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
name="jeparla-${stamp}.dump.gpg"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Custom format (-Fc): compressed, restorable table by table. As the image superuser inside the container,
# so the dump has every role's objects; --no-owner/--no-acl are applied on restore instead.
docker compose exec -T postgres pg_dump -U postgres -d "$db" -Fc --no-password \
  | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
        --symmetric --cipher-algo AES256 --output "$work/$name"

size="$(wc -c < "$work/$name")"
if [ "$size" -lt 1024 ]; then
  echo "backup too small ($size bytes), not uploaded" >&2
  exit 1
fi

# R2: auto. Oracle Object Storage (S3 compatibility): the region, e.g. eu-frankfurt-1.
AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}" aws s3 cp --only-show-errors --endpoint-url "$BACKUP_S3_ENDPOINT" \
  "$work/$name" "s3://${BACKUP_S3_BUCKET}/${prefix}${name}"
echo "backup ok: s3://${BACKUP_S3_BUCKET}/${prefix}${name} (${size} bytes)"
