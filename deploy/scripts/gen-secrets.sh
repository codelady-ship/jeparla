#!/usr/bin/env bash
# Fills every EMPTY secret in deploy/.env with a fresh random value (openssl rand -hex 32), on the VM itself,
# so no password ever travels through a chat, an email or the repository. Values already set are kept,
# so running it again changes nothing. Run once after `cp deploy/.env.example deploy/.env`.
#
#   deploy/scripts/gen-secrets.sh
#
# Changing a database password later is NOT done by editing .env: the roles keep the password they were
# created with on the first start (docker/postgres/10-jeparla-roles.sh).
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is missing: cp deploy/.env.example deploy/.env" >&2; exit 1; }
chmod 600 "$ENV_FILE"

SECRETS=(
  JEPARLA_JWT_SECRET
  JEPARLA_FRONTEND_TOKEN
  JEPARLA_DB_ADMIN_PASSWORD
  JEPARLA_DB_MIGRATION_PASSWORD
  JEPARLA_DB_PASSWORD
  JEPARLA_REDIS_PASSWORD
  JEPARLA_S3_SECRET_KEY
  JEPARLA_INTERNAL_JOB_TOKEN
)

for name in "${SECRETS[@]}"; do
  if grep -qE "^${name}=$" "$ENV_FILE"; then
    sed -i -E "s/^${name}=$/${name}=$(openssl rand -hex 32)/" "$ENV_FILE"
    echo "generated $name"
  elif grep -qE "^${name}=" "$ENV_FILE"; then
    echo "kept      $name (already set)"
  fi
done
echo "done; the values stay in $ENV_FILE (chmod 600). Keep a copy of the file in a password manager."
