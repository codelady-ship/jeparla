-- Daily metal price job (#43, #44).

-- 1. ShedLock: the job runs on one instance at a time (net.javacrumbs.shedlock, JdbcTemplateLockProvider
--    with database time). One row per lock name; the row is updated, never deleted.
CREATE TABLE shedlock
(
    name       VARCHAR(64)  NOT NULL PRIMARY KEY,
    lock_until TIMESTAMPTZ  NOT NULL,
    locked_at  TIMESTAMPTZ  NOT NULL,
    locked_by  VARCHAR(255) NOT NULL
);

-- 2. One CBAR quote per metal and business day stays unique (the fetch job is idempotent), but an admin
--    may override the price in use more than once on the same day (a typo must be fixable at once, PLAN
--    5.10: a wrong price is an S1 bug). The newest override (highest id) of a day is the one in use.
ALTER TABLE metal_price_snapshots DROP CONSTRAINT metal_price_snapshots_metal_date_source_key;
CREATE UNIQUE INDEX metal_price_snapshots_metal_date_source_key ON metal_price_snapshots (metal, quote_date, source)
    WHERE source = 'CBAR';
