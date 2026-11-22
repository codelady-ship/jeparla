-- The seller closed the first-visit guide of the cabinet (#301): kept on the store, not per browser,
-- so a second device does not show it again.
ALTER TABLE stores
    ADD COLUMN guide_dismissed_at TIMESTAMPTZ;
