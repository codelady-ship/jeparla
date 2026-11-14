-- Admin API gaps (#40, #41).
--
-- 1. product_reports: a complaint is about a product or about a store (PLAN 5.8). Every row now names the store
--    (for a product complaint: the product's store, so the admin filters by store); product_id is set only for a
--    product complaint. The table keeps its name; it is the one complaints queue.
-- 2. favorites: the price of the product's cheapest live variant when it was saved, so the frontend can show
--    how the price changed since (#112). NULL for rows saved before this migration: unknown, never a fake zero.
--
-- No new tables: the runtime role keeps its grants on both tables (V16); new columns need none of their own.

-- ------------------------------------------------------------------ complaints about stores

ALTER TABLE product_reports
    ADD COLUMN store_id BIGINT REFERENCES stores (id) ON DELETE RESTRICT;

UPDATE product_reports r
SET store_id = p.store_id
FROM products p
WHERE p.id = r.product_id;

ALTER TABLE product_reports
    ALTER COLUMN store_id SET NOT NULL,
    ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX product_reports_store_idx ON product_reports (store_id, status, created_at DESC);

-- ------------------------------------------------------------------ favourite price at save time

ALTER TABLE favorites
    ADD COLUMN saved_price    NUMERIC(12, 2),
    ADD COLUMN saved_currency CHAR(3),
    ADD CONSTRAINT favorites_saved_price CHECK (saved_price IS NULL OR saved_price >= 0),
    ADD CONSTRAINT favorites_saved_price_currency CHECK ((saved_price IS NULL) = (saved_currency IS NULL));

-- The user's list, newest first (GET /api/v1/favorites).
CREATE INDEX favorites_user_created_idx ON favorites (user_id, created_at DESC, id DESC);
