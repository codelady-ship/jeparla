-- A variant's fineness belongs to its product's metal (#122). A GOLD product with a SILVER 925
-- variant would get the silver gram price under METAL_LINKED pricing: a wrong price is an S1 bug
-- (PLAN 5.10), so the database refuses it, not only the API.
--
-- product_variants.metal is a copy of finenesses.metal, filled by a trigger from fineness_id (callers
-- never write it). Two composite foreign keys then make the three metals equal:
--   (fineness_id, metal) -> finenesses (id, metal): the copy is right, and a fineness in use cannot
--                                                   change its metal;
--   (product_id, metal)  -> products (id, metal):   the variant has its product's metal.
-- The product key is DEFERRABLE INITIALLY DEFERRED: changing a product's metal and the finenesses
-- of its variants in one transaction is checked at COMMIT, in either statement order.

ALTER TABLE finenesses
    ADD CONSTRAINT finenesses_id_metal_key UNIQUE (id, metal);

ALTER TABLE products
    ADD CONSTRAINT products_id_metal_key UNIQUE (id, metal);

ALTER TABLE product_variants
    ADD COLUMN metal TEXT;

-- Backfill from the fineness. Rows that already disagree with their product stop the migration
-- with their ids: they need a decision (which metal is right), not a silent fix.
UPDATE product_variants v
SET metal = f.metal
FROM finenesses f
WHERE f.id = v.fineness_id;

DO
$$
DECLARE
    mismatched TEXT;
BEGIN
    SELECT string_agg(v.id::text, ', ' ORDER BY v.id)
    INTO mismatched
    FROM product_variants v
             JOIN products p ON p.id = v.product_id
    WHERE p.metal <> v.metal;
    IF mismatched IS NOT NULL THEN
        RAISE EXCEPTION 'product_variants whose fineness metal differs from the product metal: %', mismatched
            USING HINT = 'Point these variants at a fineness of the product metal, then run the migration again.';
    END IF;
END
$$;

ALTER TABLE product_variants
    ALTER COLUMN metal SET NOT NULL,
    ADD CONSTRAINT product_variants_metal CHECK (metal IN ('GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM')),
    ADD CONSTRAINT product_variants_fineness_metal_fk FOREIGN KEY (fineness_id, metal)
        REFERENCES finenesses (id, metal) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT product_variants_product_metal_fk FOREIGN KEY (product_id, metal)
        REFERENCES products (id, metal) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- The copy follows fineness_id on every insert and update, whatever the caller sent.
CREATE FUNCTION jeparla_variant_metal() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    SELECT f.metal INTO NEW.metal FROM finenesses f WHERE f.id = NEW.fineness_id;
    IF NOT FOUND THEN
        -- Report the missing fineness as the foreign key error it is, not as "metal is null".
        RAISE EXCEPTION 'fineness % does not exist', NEW.fineness_id
            USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'product_variants_fineness_metal_fk';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER product_variants_metal
    BEFORE INSERT OR UPDATE OF fineness_id, metal
    ON product_variants
    FOR EACH ROW
EXECUTE FUNCTION jeparla_variant_metal();
