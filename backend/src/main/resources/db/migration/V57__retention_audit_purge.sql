-- Retention automation (#249, docs/legal/analysis.md section 5).
--
-- The audit log is kept 7 years (the privacy policy promises it, analysis.md section 5). Until now
-- jeparla_purge_audit_logs (V16) had a 5-year floor and only the migration role could call it, so nothing ran.
-- This migration:
--   1. raises the floor of the function and of the append-only trigger to 7 years;
--   2. makes the function skip what must stay:
--      * every row about a store under legal hold (stores.legal_hold_at, V56): the store itself, its products,
--        documents and complaints, or any row whose details name the store (storeId);
--      * the audit rows of a declaration upload (DECLARATION_CONFIRMED, DOCUMENT_UPLOADED with a declarationId):
--        they are evidence with the declaration and are pseudonymised, not deleted (V56);
--   3. lets the runtime role EXECUTE it, for the daily RetentionJob. The function is SECURITY DEFINER and checks
--      the floor itself; the runtime role still has no DELETE on audit_logs.
--
-- Documents and complaints are ordinary tables (the runtime role may DELETE them); RetentionJob deletes them with
-- the conditions in RetentionStore and never touches a store under legal hold.

-- ------------------------------------------------------------------ audit_logs trigger

-- V56's function with the DELETE floor at 7 years.
CREATE OR REPLACE FUNCTION jeparla_audit_logs_append_only() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.actor_id IS NULL
        AND to_jsonb(NEW) - 'actor_id' = to_jsonb(OLD) - 'actor_id' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND current_setting('jeparla.pseudonymise', true) = 'on'
        AND OLD.created_at < now() - INTERVAL '7 years'
        AND NEW.ip_address IS NULL AND NEW.actor_label ~ '^hmac-sha256:[0-9a-f]{64}$'
        AND to_jsonb(NEW) - 'ip_address' - 'actor_label' = to_jsonb(OLD) - 'ip_address' - 'actor_label' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND current_setting('jeparla.audit_purge', true) = 'on'
        AND OLD.created_at < now() - INTERVAL '7 years' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;

-- ------------------------------------------------------------------ the purge

CREATE OR REPLACE FUNCTION jeparla_purge_audit_logs(keep INTERVAL) RETURNS BIGINT
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS
$$
DECLARE
    removed BIGINT;
BEGIN
    IF keep IS NULL OR keep < INTERVAL '7 years' THEN
        RAISE EXCEPTION 'audit log retention must be at least 7 years, got %', keep
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM set_config('jeparla.audit_purge', 'on', true);
    DELETE
    FROM public.audit_logs a
    WHERE a.created_at < now() - keep
      -- Evidence of a declaration upload: pseudonymised with the declaration, never deleted.
      AND NOT (a.action IN ('DECLARATION_CONFIRMED', 'DOCUMENT_UPLOADED')
          AND (a.details ->> 'declarationId') IS NOT NULL)
      -- Legal hold: nothing about the store goes.
      AND NOT EXISTS (SELECT 1
                      FROM public.stores s
                      WHERE s.legal_hold_at IS NOT NULL
                        AND ((a.target_type = 'STORE' AND a.target_id = s.id::TEXT)
                          OR a.details ->> 'storeId' = s.id::TEXT
                          OR (a.target_type = 'PRODUCT' AND EXISTS (
                              SELECT 1 FROM public.products p
                              WHERE p.store_id = s.id AND p.id::TEXT = a.target_id))
                          OR (a.target_type = 'DOCUMENT' AND EXISTS (
                              SELECT 1 FROM public.verification_documents d
                              WHERE d.store_id = s.id AND d.id::TEXT = a.target_id))
                          OR (a.target_type = 'REPORT' AND EXISTS (
                              SELECT 1 FROM public.product_reports r
                              WHERE r.store_id = s.id AND r.id::TEXT = a.target_id))));
    GET DIAGNOSTICS removed = ROW_COUNT;
    PERFORM set_config('jeparla.audit_purge', 'off', true);
    RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION jeparla_purge_audit_logs(INTERVAL) FROM PUBLIC;
DO
$$
BEGIN
    EXECUTE format('GRANT EXECUTE ON FUNCTION jeparla_purge_audit_logs(INTERVAL) TO %I', '${runtimerole}');
END;
$$;

-- ------------------------------------------------------------------ indexes of the daily job

CREATE INDEX verification_documents_reviewed_idx ON verification_documents (reviewed_at)
    WHERE status IN ('VERIFIED', 'REJECTED', 'CHANGES_REQUESTED');
CREATE INDEX product_reports_resolved_idx ON product_reports (resolved_at)
    WHERE status IN ('RESOLVED', 'DISMISSED');
