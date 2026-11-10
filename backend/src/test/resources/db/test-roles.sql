-- Test container roles (#165), as docker/postgres/10-jeparla-roles.sh creates them in Docker Compose:
-- the migration role owns the database (and so the schema public), the runtime role owns nothing.
-- Runs once per container as its superuser. Test-only passwords (PostgresContainerConfig).
CREATE ROLE jeparla_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'owner-test';
CREATE ROLE jeparla_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'app-test';
ALTER DATABASE test OWNER TO jeparla_owner;
