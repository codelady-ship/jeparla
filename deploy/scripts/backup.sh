#!/usr/bin/env bash
# Nightly backup of the production database: runs the existing docker/backup/pg-backup.sh (#56, #209)
# against deploy/docker-compose.prod.yml. Cron line and the backup env file: docs/deploy.md, "Backup".
#
#   deploy/scripts/backup.sh               # backup now
#   deploy/scripts/backup.sh restore-test  # restore the latest backup into a throw-away container
#
# Reads ~/.jeparla-backup.env (chmod 600) for the bucket and its key; nothing secret is kept here.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-$HOME/.jeparla-backup.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE is missing (docs/deploy.md, Backup)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

cd "$APP_DIR"
# The backup scripts call plain `docker compose`: point it at the production file and its .env.
export COMPOSE_FILE="$APP_DIR/deploy/docker-compose.prod.yml"
JEPARLA_DB_NAME="$(grep -E '^JEPARLA_DB_NAME=' deploy/.env | cut -d= -f2- || true)"
export JEPARLA_DB_NAME="${JEPARLA_DB_NAME:-jeparla}"

case "${1:-backup}" in
  backup) exec docker/backup/pg-backup.sh ;;
  restore-test) exec docker/backup/pg-restore-test.sh "${@:2}" ;;
  *) echo "usage: $0 [backup|restore-test]" >&2; exit 2 ;;
esac
