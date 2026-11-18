#!/usr/bin/env bash
# CI only (#41): test accounts for the frontend e2e suite against the real API (frontend/e2e, real mode).
# Runs after `docker compose -f docker-compose.yml -f docker/e2e/compose.e2e.yml up`, from the repository
# root, with the API on 127.0.0.1:8080. The demo catalog itself comes from the backend `demo` profile.
#
#   E2E_PASSWORD   password of the merchant and admin test accounts (letters and digits, 8+ characters)
#
# Accounts (all on the reserved .test domain, nothing real):
#   e2e-merchant@jeparla.test  MERCHANT, owner of the demo store ayzer-zerger
#   e2e-admin@jeparla.test     ADMIN
#   one buyer per one-time link the recovery tests open, each with its own token
#   (e2e-<purpose>-<project>-<retry>): a used reset or verification link ends the user's other links.
set -euo pipefail

: "${E2E_PASSWORD:?set E2E_PASSWORD}"
API="${E2E_API:-http://127.0.0.1:8080}/api/v1"
COMPOSE=(docker compose -f docker-compose.yml -f docker/e2e/compose.e2e.yml)

post() {
  local status
  status=$(curl -sS -o /tmp/e2e-seed-response -w '%{http_code}' -X POST "$API$1" \
    -H 'Content-Type: application/json' -H 'Accept-Language: az' --data "$2")
  if [ "$status" != 201 ]; then
    echo "POST $1 answered $status:" >&2
    cat /tmp/e2e-seed-response >&2
    exit 1
  fi
}

post /auth/register/merchant \
  "{\"name\":\"E2E Satıcı\",\"phone\":\"050 000 99 01\",\"email\":\"e2e-merchant@jeparla.test\",\"password\":\"$E2E_PASSWORD\"}"
post /auth/register \
  "{\"name\":\"E2E Admin\",\"email\":\"e2e-admin@jeparla.test\",\"password\":\"$E2E_PASSWORD\"}"

"${COMPOSE[@]}" exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U postgres -d "$POSTGRES_DB"' <<'SQL'
BEGIN;

-- The admin: ADMIN instead of the USER role of the sign-up.
DELETE FROM user_roles WHERE user_id = (SELECT id FROM users WHERE email = 'e2e-admin@jeparla.test');
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'ADMIN' WHERE u.email = 'e2e-admin@jeparla.test';

-- The merchant takes over the first demo store (the demo merchants cannot sign in).
UPDATE stores SET owner_id = (SELECT id FROM users WHERE email = 'e2e-merchant@jeparla.test')
WHERE slug = 'ayzer-zerger';

-- Buyers with one known reset or verification token each (stored as the API stores it: SHA-256 hex).
INSERT INTO users (email, password_hash, display_name, email_verified, preferred_locale)
SELECT 'e2e-' || p.purpose || '-' || pr.project || '-' || rt.retry || '@jeparla.test', 'E2E-ACCOUNT-NO-LOGIN',
       'E2E buyer', FALSE, 'az'
FROM (VALUES ('reset'), ('verify')) AS p (purpose),
     (VALUES ('mobile'), ('desktop')) AS pr (project),
     (VALUES (0), (1)) AS rt (retry);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'USER'
WHERE u.email ~ '^e2e-(reset|verify)-';

INSERT INTO account_tokens (user_id, purpose, token_hash, email, expires_at)
SELECT u.id,
       CASE WHEN u.email LIKE 'e2e-reset-%' THEN 'PASSWORD_RESET' ELSE 'EMAIL_VERIFICATION' END,
       encode(sha256(convert_to(split_part(u.email, '@', 1), 'UTF8')), 'hex'),
       u.email,
       now() + INTERVAL '6 hours'
FROM users u
WHERE u.email ~ '^e2e-(reset|verify)-';

COMMIT;
SQL

echo "e2e accounts ready"
