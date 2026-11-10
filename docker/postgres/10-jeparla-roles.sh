#!/bin/sh
# Jeparla database roles (#165). Runs once, when the postgres container initialises an empty data volume
# (/docker-entrypoint-initdb.d), as the image's superuser, which only this container knows.
#
#   JEPARLA_DB_MIGRATION_USER  owns the database and so the schema public; only Flyway connects with it.
#   JEPARLA_DB_USER            the API; no superuser, owns nothing. Migration V16 grants it SELECT, INSERT,
#                              UPDATE, DELETE on ordinary tables and SELECT, INSERT only on the evidence tables.
#
# Existing volume: backend/README.md, "Verilənlər bazası rolları".
set -eu

: "${JEPARLA_DB_MIGRATION_USER:?}" "${JEPARLA_DB_MIGRATION_PASSWORD:?}" "${JEPARLA_DB_USER:?}" "${JEPARLA_DB_PASSWORD:?}"

if [ "$JEPARLA_DB_MIGRATION_USER" = "$JEPARLA_DB_USER" ]; then
  echo "JEPARLA_DB_MIGRATION_USER and JEPARLA_DB_USER must differ" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" \
  -v owner="$JEPARLA_DB_MIGRATION_USER" -v owner_password="$JEPARLA_DB_MIGRATION_PASSWORD" \
  -v app="$JEPARLA_DB_USER" -v app_password="$JEPARLA_DB_PASSWORD" <<'SQL'
CREATE ROLE :"owner" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    PASSWORD :'owner_password';
CREATE ROLE :"app" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    PASSWORD :'app_password';
ALTER DATABASE :"db" OWNER TO :"owner";
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db" TO :"app";
SQL

echo "roles ready: $JEPARLA_DB_MIGRATION_USER (owner, migrations), $JEPARLA_DB_USER (API)"
