-- Merchant API (#39) and bijouterie / fashion sellers (#128).
--
-- 1. What a store sells: PRECIOUS (gold, silver, platinum, diamonds), FASHION (bijouterie and handmade
--    jewelry from beads, steel, copper, leather ...) or MIXED (both). Existing stores are PRECIOUS.
-- 2. What a product is made of: PRECIOUS products have a metal, every variant a fineness and a weight, and
--    may follow the metal price (METAL_LINKED). FASHION products have no metal and no fineness, a material
--    instead, FIXED prices only, and never a "documents verified" or "expertise" check: there is nothing
--    to certify, and a badge would be false trust (#128).
-- 3. One store per merchant, and Idempotency-Key values of the create requests (a double submit
--    returns the first result instead of a second store or product).

-- ------------------------------------------------------------------ stores

ALTER TABLE stores
    ADD COLUMN seller_kind     TEXT NOT NULL DEFAULT 'PRECIOUS',
    ADD COLUMN idempotency_key UUID,
    ADD CONSTRAINT stores_seller_kind CHECK (seller_kind IN ('PRECIOUS', 'FASHION', 'MIXED')),
    -- A bijouterie seller has no business documents to check for precious metals (#128).
    ADD CONSTRAINT stores_fashion_without_documents CHECK (seller_kind <> 'FASHION' OR documents_status = 'NONE');

-- The merchant cabinet has one store per account (GET /api/v1/merchant/store).
CREATE UNIQUE INDEX stores_owner_key ON stores (owner_id);
DROP INDEX stores_owner_id_idx;

-- ------------------------------------------------------------------ products

ALTER TABLE products
    ADD COLUMN material_kind   TEXT NOT NULL DEFAULT 'PRECIOUS',
    -- Main material of a FASHION product; NULL for PRECIOUS ones.
    ADD COLUMN material        TEXT,
    -- When the seller confirmed "this is not a precious metal" (FASHION only, required).
    ADD COLUMN not_precious_confirmed_at TIMESTAMPTZ,
    -- Set when the seller hid an APPROVED product; only such a product may be shown again without review.
    -- An admin deactivation leaves it false.
    ADD COLUMN hidden_by_seller BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN idempotency_key UUID,
    ALTER COLUMN metal DROP NOT NULL,
    ADD CONSTRAINT products_material_kind CHECK (material_kind IN ('PRECIOUS', 'FASHION')),
    ADD CONSTRAINT products_metal_by_kind CHECK ((material_kind = 'PRECIOUS') = (metal IS NOT NULL)),
    ADD CONSTRAINT products_material CHECK (material IS NULL OR material IN (
        'BEADS', 'STAINLESS_STEEL', 'COPPER', 'BRASS', 'SILVER_PLATED', 'GOLD_PLATED', 'LEATHER', 'TEXTILE',
        'WOOD', 'GLASS', 'CERAMIC', 'RESIN', 'NATURAL_STONE', 'OTHER')),
    ADD CONSTRAINT products_material_by_kind CHECK (
        (material_kind = 'FASHION') = (material IS NOT NULL)
            AND (material_kind = 'FASHION') = (not_precious_confirmed_at IS NOT NULL)),
    -- No expertise for bijouterie (#128): the badge would claim a check that never happened.
    ADD CONSTRAINT products_fashion_without_expertise CHECK (material_kind <> 'FASHION' OR expertise_status = 'NONE'),
    ADD CONSTRAINT products_hidden_by_seller CHECK (NOT hidden_by_seller OR status = 'INACTIVE'),
    -- Target of the composite foreign key from product_variants (the variant has its product's kind).
    ADD CONSTRAINT products_id_material_kind_key UNIQUE (id, material_kind);

CREATE UNIQUE INDEX products_store_idempotency_key ON products (store_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------------ variants

-- material_kind is a copy of the product's kind, filled by a trigger (callers never write it). The
-- composite foreign key keeps it equal to the product, so the CHECK below holds for the product's kind:
-- a FASHION variant has no fineness (so no metal, V10) and a FIXED price, a PRECIOUS variant has both a
-- fineness and a weight. The daily repricing (#44) therefore never sees a FASHION variant.
ALTER TABLE product_variants
    ADD COLUMN material_kind TEXT NOT NULL DEFAULT 'PRECIOUS',
    ALTER COLUMN fineness_id DROP NOT NULL,
    ALTER COLUMN metal DROP NOT NULL,
    ALTER COLUMN weight_grams DROP NOT NULL,
    ADD CONSTRAINT product_variants_material_kind CHECK (material_kind IN ('PRECIOUS', 'FASHION')),
    ADD CONSTRAINT product_variants_by_kind CHECK (
        CASE material_kind
            WHEN 'PRECIOUS' THEN fineness_id IS NOT NULL AND metal IS NOT NULL AND weight_grams IS NOT NULL
            ELSE fineness_id IS NULL AND metal IS NULL AND pricing_mode = 'FIXED' AND metal_snapshot_id IS NULL
        END),
    ADD CONSTRAINT product_variants_product_kind_fk FOREIGN KEY (product_id, material_kind)
        REFERENCES products (id, material_kind) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION jeparla_variant_material_kind() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    SELECT p.material_kind INTO NEW.material_kind FROM products p WHERE p.id = NEW.product_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'product % does not exist', NEW.product_id
            USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'product_variants_product_kind_fk';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER product_variants_material_kind
    BEFORE INSERT OR UPDATE OF product_id, material_kind
    ON product_variants
    FOR EACH ROW
EXECUTE FUNCTION jeparla_variant_material_kind();

-- V10's metal copy: a variant without a fineness (FASHION) has no metal.
CREATE OR REPLACE FUNCTION jeparla_variant_metal() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF NEW.fineness_id IS NULL THEN
        NEW.metal := NULL;
        RETURN NEW;
    END IF;
    SELECT f.metal INTO NEW.metal FROM finenesses f WHERE f.id = NEW.fineness_id;
    IF NOT FOUND THEN
        -- Report the missing fineness as the foreign key error it is, not as "metal is null".
        RAISE EXCEPTION 'fineness % does not exist', NEW.fineness_id
            USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'product_variants_fineness_metal_fk';
    END IF;
    RETURN NEW;
END;
$$;
