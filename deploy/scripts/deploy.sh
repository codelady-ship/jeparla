#!/usr/bin/env bash
# Deploy or update the Jeparla backend stack on the VM (docs/deploy.md). Run from anywhere:
#
#   /opt/jeparla/deploy/scripts/deploy.sh            # pull main, rebuild the API image, restart what changed
#   BRANCH=some-branch deploy/scripts/deploy.sh      # another branch (testing only)
#   SKIP_PULL=1 deploy/scripts/deploy.sh             # no git pull (local edits, first start)
#
# Flyway migrations run when the API starts; a failed migration keeps the API unhealthy and this script
# exits non-zero, while PostgreSQL and its data stay untouched.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE=(docker compose -f "$APP_DIR/deploy/docker-compose.prod.yml")
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

if [ ! -f deploy/.env ]; then
  echo "deploy/.env is missing: cp deploy/.env.example deploy/.env, fill it in, chmod 600 (docs/deploy.md)" >&2
  exit 1
fi
if [ "$(stat -c %a deploy/.env)" != "600" ]; then
  chmod 600 deploy/.env
  echo "deploy/.env permissions set to 600"
fi

if [ -z "${SKIP_PULL:-}" ]; then
  git fetch --quiet origin "$BRANCH"
  git checkout --quiet "$BRANCH"
  git pull --ff-only --quiet origin "$BRANCH"
fi
echo "== revision $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"

# Validates the file and the .env (missing required values stop here, before anything restarts).
"${COMPOSE[@]}" config --quiet

export GIT_REVISION="$(git rev-parse --short=12 HEAD)"

wait_healthy() {
  local service="$1" tries="$2" status=""
  for _ in $(seq 1 "$tries"); do
    status="$("${COMPOSE[@]}" ps --format '{{.Health}}' "$service" 2>/dev/null || true)"
    [ "$status" = "healthy" ] && return 0
    sleep 5
  done
  echo "$service is not healthy ($status); last log lines:" >&2
  "${COMPOSE[@]}" logs --tail 80 "$service" >&2
  return 1
}

# 1. Backend first: the site build below reads the catalog from the running API.
"${COMPOSE[@]}" build --pull api
# Every service except the site (the s3 ones only exist with COMPOSE_PROFILES=local-s3).
"${COMPOSE[@]}" up -d --remove-orphans $("${COMPOSE[@]}" config --services | grep -vx web)
echo "== waiting for the API (first start with migrations: up to 3 minutes)"
wait_healthy api 36

# Caddy needs a few seconds for the first certificate; the site build calls https://API_DOMAIN.
api_domain="$(grep -E '^API_DOMAIN=' deploy/.env | cut -d= -f2-)"
for _ in $(seq 1 24); do
  curl -fsS -o /dev/null --resolve "${api_domain}:443:127.0.0.1" "https://${api_domain}/actuator/health" && break
  sleep 5
done

# 2. The site: built against the live API, then started.
"${COMPOSE[@]}" build --pull web
"${COMPOSE[@]}" up -d web
echo "== waiting for the site"
wait_healthy web 24
"${COMPOSE[@]}" ps

# Old image layers fill the boot volume over time.
docker image prune -f >/dev/null

site_domain="$(grep -E '^SITE_DOMAIN=' deploy/.env | cut -d= -f2-)"
echo "== done. Check from outside:"
echo "   https://${site_domain}/az"
echo "   https://${api_domain}/actuator/health"
