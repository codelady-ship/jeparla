-- Jeparla schema, part 1: extensions and helper functions.
--
-- Conventions for every migration (#32):
--   * money NUMERIC(12,2) + currency CHAR(3); weight NUMERIC(8,3); carat NUMERIC(8,3).
--     float4, float8, real and double precision are forbidden (MigrationTests fails on them).
--   * timestamps are TIMESTAMPTZ (stored in UTC), defaulting to now().
--   * enums are TEXT + CHECK (JPA EnumType.STRING), not PostgreSQL enum types, so a new value
--     is a one-line migration.
--   * localized text is one column per language: *_az (required), *_en, *_ru.
--   * every foreign key states its ON DELETE rule.

-- Trigram similarity for typo-tolerant search (PLAN 5.3). Trusted extension: the database
-- owner can create it without superuser rights.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Folds Azerbaijani letters the same way as frontend/src/lib/search/normalize.ts, so
-- "uzuk" matches "üzük", "sirga" matches "sırğa", "qizil" matches "qızıl".
-- I/İ/ı are folded before lower() so the result does not depend on the database locale.
-- Punctuation becomes a single space. IMMUTABLE: used by generated search columns.
CREATE FUNCTION jeparla_fold(input TEXT) RETURNS TEXT
    LANGUAGE sql
    IMMUTABLE
    STRICT
    PARALLEL SAFE
RETURN btrim(regexp_replace(
        lower(translate(input, 'ƏəİIıŞşÇçĞğÖöÜüЁё', 'eeiiissccggoouuее')),
        '[^[:alnum:]]+', ' ', 'g'));

-- Products are never deleted (PLAN 5.2): they become INACTIVE and get deleted_at.
CREATE FUNCTION jeparla_forbid_delete() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    RAISE EXCEPTION '% rows are never deleted; set status and deleted_at instead', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;
