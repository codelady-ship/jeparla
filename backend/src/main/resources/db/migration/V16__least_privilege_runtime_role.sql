-- Least-privilege database roles and immutable evidence tables (#165).
--
-- Two roles (created outside Flyway, see backend/README.md "Verilənlər bazası rolları"):
--   * migration role: owns the schema and every table; only Flyway connects with it
--     (spring.flyway.user, JEPARLA_DB_MIGRATION_USER). This script runs as that role.
--   * runtime role: the API connects with it (spring.datasource.username, JEPARLA_DB_USER). Not a superuser,
--     owns nothing, so it can neither ALTER/DROP a table or trigger nor SET session_replication_role.
--     Its name reaches this script as the Flyway placeholder runtimerole (spring.flyway.placeholders.runtimerole).
--
-- Evidence tables (docs/legal/sellers-liability.md 3.3: append-only, never updated or deleted):
--   * seller_declarations (V15) and audit_logs (V7): the runtime role gets SELECT and INSERT only.
--   * Account deletion still works: ON DELETE SET NULL of users runs as the owner of the referencing table
--     (PostgreSQL referential actions), and the append-only triggers let exactly that change through.
--   * BEFORE TRUNCATE triggers: TRUNCATE does not fire row-level DELETE triggers, so it is refused separately,
--     also when it arrives through TRUNCATE ... CASCADE of another table.

-- ------------------------------------------------------------------ runtime role checks and grants

DO
$$
DECLARE
    runtime CONSTANT TEXT := '${runtimerole}';
    role_row pg_roles%ROWTYPE;
BEGIN
    SELECT * INTO role_row FROM pg_roles WHERE rolname = runtime;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'runtime role "%" does not exist; create it before migrating (backend/README.md, #165)', runtime;
    END IF;
    IF runtime = current_user THEN
        RAISE EXCEPTION 'the runtime role must differ from the migration role "%" (JEPARLA_DB_USER vs JEPARLA_DB_MIGRATION_USER, #165)',
            current_user;
    END IF;
    IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolreplication THEN
        RAISE EXCEPTION 'runtime role "%" must not be a superuser or have CREATEROLE, REPLICATION or BYPASSRLS (#165)',
            runtime;
    END IF;
    IF pg_has_role(runtime, current_user, 'MEMBER') THEN
        RAISE EXCEPTION 'runtime role "%" must not be a member of the migration role "%" (#165)', runtime, current_user;
    END IF;
    IF EXISTS (SELECT 1
               FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public'
                 AND pg_has_role(runtime, c.relowner, 'USAGE')) THEN
        RAISE EXCEPTION 'runtime role "%" must not own tables of the schema public (#165)', runtime;
    END IF;

    -- No role may create objects in the schema except its owner (PostgreSQL 15+ default, stated for older dumps).
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime);

    -- Ordinary tables: the application reads and writes them; TRUNCATE, REFERENCES and TRIGGER are not granted.
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', runtime);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', runtime);
    -- Tables and sequences created by later migrations (this role creates them) get the same grants.
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
                   runtime);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', runtime);

    -- Flyway's history is read-only for the application.
    EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', '${flyway:table}', runtime);
    EXECUTE format('GRANT SELECT ON TABLE %I TO %I', '${flyway:table}', runtime);

    -- Evidence: SELECT and INSERT only.
    EXECUTE format('REVOKE ALL ON TABLE seller_declarations, audit_logs FROM %I', runtime);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE seller_declarations, audit_logs TO %I', runtime);
END;
$$;

-- ------------------------------------------------------------------ TRUNCATE

CREATE FUNCTION jeparla_forbid_truncate() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    RAISE EXCEPTION '% is evidence and is never truncated', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER seller_declarations_no_truncate
    BEFORE TRUNCATE
    ON seller_declarations
    FOR EACH STATEMENT
EXECUTE FUNCTION jeparla_forbid_truncate();

CREATE TRIGGER audit_logs_no_truncate
    BEFORE TRUNCATE
    ON audit_logs
    FOR EACH STATEMENT
EXECUTE FUNCTION jeparla_forbid_truncate();

-- ------------------------------------------------------------------ audit_logs: append-only

-- Was append-only by convention (V7). Allowed changes:
--   * actor_id to NULL when the account is deleted (ON DELETE SET NULL; actor_label keeps who it was);
--   * deleting rows older than the retention period, only inside jeparla_purge_audit_logs below.
CREATE FUNCTION jeparla_audit_logs_append_only() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL
        AND to_jsonb(NEW) - 'actor_id' = to_jsonb(OLD) - 'actor_id' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND current_setting('jeparla.audit_purge', true) = 'on'
        AND OLD.created_at < now() - INTERVAL '5 years' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_logs_append_only
    BEFORE UPDATE OR DELETE
    ON audit_logs
    FOR EACH ROW
EXECUTE FUNCTION jeparla_audit_logs_append_only();

-- Retention of the audit log (V7 comment, PLAN 3a: the VM disk is limited). The period is not decided yet
-- (docs/legal/sellers-liability.md 3.6 proposes at least 5 years, the lawyer confirms it, #57); the function
-- refuses anything shorter, and the trigger above checks the same floor. Only the owner (migration role) may
-- call it: there is no scheduled job and the runtime role has no EXECUTE.
CREATE FUNCTION jeparla_purge_audit_logs(keep INTERVAL) RETURNS BIGINT
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS
$$
DECLARE
    removed BIGINT;
BEGIN
    IF keep IS NULL OR keep < INTERVAL '5 years' THEN
        RAISE EXCEPTION 'audit log retention must be at least 5 years, got %', keep
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM set_config('jeparla.audit_purge', 'on', true);
    DELETE FROM public.audit_logs WHERE created_at < now() - keep;
    GET DIAGNOSTICS removed = ROW_COUNT;
    PERFORM set_config('jeparla.audit_purge', 'off', true);
    RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION jeparla_purge_audit_logs(INTERVAL) FROM PUBLIC;
