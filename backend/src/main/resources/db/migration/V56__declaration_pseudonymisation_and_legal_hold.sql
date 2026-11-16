-- Retention of the personal data in the seller declarations (#138, docs/legal/analysis.md section 5).
--
-- The declaration row is evidence and is never deleted (verification_documents.declaration_id points at it).
-- What is personal in it, the IP address and the user label ("<name> <email or phone>"), is kept only while it
-- can still serve as evidence: N years (at least 7, the limitation period of criminal liability for a "less
-- serious" crime, Criminal Code art. 15.3 and 75.1, see analysis.md) after the later of
--   * the store's last declaration, and
--   * the end of the store's relationship with Jeparla (the store is no longer APPROVED; stores.updated_at of
--     that change, or of any later change, counts).
-- Then the IP becomes NULL and the label becomes a keyed hash (HMAC-SHA256, the key is only in the API's env):
-- a court or authority request can still be matched against a known person's label, the label itself is gone.
-- The audit rows of the same upload (DECLARATION_CONFIRMED, DOCUMENT_UPLOADED with that declarationId) get the
-- same change. A store under legal hold is never touched.
--
-- 1. stores.legal_hold_at / legal_hold_reason: set by an admin (POST /api/v1/admin/stores/{id}/legal-hold).
-- 2. seller_declarations.pseudonymised_at.
-- 3. The append-only triggers let exactly the pseudonymisation through, only inside the function below.
-- 4. jeparla_pseudonymise_declaration(id, label_hash, years): SECURITY DEFINER, owned by the migration role. The
--    runtime role may EXECUTE it (the scheduled job), but it still has no UPDATE on the evidence tables, and the
--    function re-checks every condition itself: a caller can only do what the job would do anyway.

-- ------------------------------------------------------------------ legal hold

ALTER TABLE stores
    ADD COLUMN legal_hold_at     TIMESTAMPTZ,
    ADD COLUMN legal_hold_reason TEXT,
    ADD CONSTRAINT stores_legal_hold CHECK ((legal_hold_at IS NULL) = (legal_hold_reason IS NULL)),
    ADD CONSTRAINT stores_legal_hold_reason CHECK (legal_hold_reason IS NULL
        OR length(btrim(legal_hold_reason)) BETWEEN 10 AND 500);

-- ------------------------------------------------------------------ declarations

ALTER TABLE seller_declarations
    ADD COLUMN pseudonymised_at TIMESTAMPTZ,
    ADD CONSTRAINT seller_declarations_pseudonymised CHECK (pseudonymised_at IS NULL
        OR (ip_address IS NULL AND user_label ~ '^hmac-sha256:[0-9a-f]{64}$'));

CREATE INDEX seller_declarations_retention_idx ON seller_declarations (confirmed_at)
    WHERE pseudonymised_at IS NULL;

-- Allowed changes: user_id to NULL (account deletion, V15) and, inside jeparla_pseudonymise_declaration only,
-- ip_address to NULL + user_label to a hash + pseudonymised_at set, on a row older than 7 years.
CREATE OR REPLACE FUNCTION jeparla_declarations_append_only() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.user_id IS NULL
        AND (NEW.id, NEW.user_label, NEW.store_id, NEW.text_version, NEW.language, NEW.text, NEW.ip_address,
             NEW.confirmed_at, NEW.pseudonymised_at)
            IS NOT DISTINCT FROM
            (OLD.id, OLD.user_label, OLD.store_id, OLD.text_version, OLD.language, OLD.text, OLD.ip_address,
             OLD.confirmed_at, OLD.pseudonymised_at) THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND current_setting('jeparla.pseudonymise', true) = 'on'
        AND OLD.pseudonymised_at IS NULL AND NEW.pseudonymised_at IS NOT NULL
        AND OLD.confirmed_at < now() - INTERVAL '7 years'
        AND NEW.ip_address IS NULL AND NEW.user_label ~ '^hmac-sha256:[0-9a-f]{64}$'
        AND (NEW.id, NEW.user_id, NEW.store_id, NEW.text_version, NEW.language, NEW.text, NEW.confirmed_at)
            IS NOT DISTINCT FROM
            (OLD.id, OLD.user_id, OLD.store_id, OLD.text_version, OLD.language, OLD.text, OLD.confirmed_at) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'seller_declarations is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;

-- ------------------------------------------------------------------ audit_logs

-- V16's function plus the pseudonymisation of an old row: ip_address to NULL and actor_label to a hash, nothing
-- else, only inside jeparla_pseudonymise_declaration.
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
        AND OLD.created_at < now() - INTERVAL '5 years' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;

-- ------------------------------------------------------------------ the pseudonymisation

-- Pseudonymises one declaration and its audit rows when it is due; returns the number of rows changed
-- (0 when it is not due: too recent, store still APPROVED or changed recently, a newer declaration of the store,
-- legal hold, or already done). years: the retention period, at least 7.
CREATE FUNCTION jeparla_pseudonymise_declaration(declaration BIGINT, label_hash TEXT, years INTEGER)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS
$$
DECLARE
    cutoff  TIMESTAMPTZ;
    changed INTEGER;
    total   INTEGER;
BEGIN
    IF years IS NULL OR years < 7 THEN
        RAISE EXCEPTION 'declaration retention must be at least 7 years, got %', years
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF label_hash IS NULL OR label_hash !~ '^hmac-sha256:[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'label_hash must be hmac-sha256:<64 hex>' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    cutoff := now() - make_interval(years => years);

    PERFORM set_config('jeparla.pseudonymise', 'on', true);
    UPDATE public.seller_declarations d
    SET ip_address       = NULL,
        user_label       = label_hash,
        pseudonymised_at = now()
    FROM public.stores s
    WHERE d.id = declaration
      AND s.id = d.store_id
      AND d.pseudonymised_at IS NULL
      AND d.confirmed_at < cutoff
      AND s.legal_hold_at IS NULL
      AND s.status <> 'APPROVED'
      AND s.updated_at < cutoff
      AND NOT EXISTS (SELECT 1
                      FROM public.seller_declarations newer
                      WHERE newer.store_id = d.store_id
                        AND newer.confirmed_at >= cutoff);
    GET DIAGNOSTICS changed = ROW_COUNT;
    total := changed;
    IF changed > 0 THEN
        UPDATE public.audit_logs a
        SET ip_address  = NULL,
            actor_label = label_hash
        WHERE a.action IN ('DECLARATION_CONFIRMED', 'DOCUMENT_UPLOADED')
          AND a.details ->> 'declarationId' = declaration::TEXT
          AND a.created_at < cutoff
          AND (a.ip_address IS NOT NULL OR a.actor_label <> label_hash);
        GET DIAGNOSTICS changed = ROW_COUNT;
        total := total + changed;
    END IF;
    PERFORM set_config('jeparla.pseudonymise', 'off', true);
    RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION jeparla_pseudonymise_declaration(BIGINT, TEXT, INTEGER) FROM PUBLIC;
DO
$$
BEGIN
    EXECUTE format('GRANT EXECUTE ON FUNCTION jeparla_pseudonymise_declaration(BIGINT, TEXT, INTEGER) TO %I',
                   '${runtimerole}');
END;
$$;
