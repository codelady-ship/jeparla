-- V70: after V68 (on-model photos, #336) and V69 (AI review index, #337); #320 must take the next free number.
-- Metal siblings (owner decision 2026-11-25): the same design sold as two products of one store, e.g. a gold
-- and a silver ring. Each product keeps its own metal, variants, prices and photos (one metal per product, V10);
-- the link only lets the product page switch between them (Qizil / Gumus). The seller sets it on both rows at
-- once; the service checks same store, both precious, different metals. The product page shows the link only
-- while the other product is public too.
--
-- V68 is left for the AI review index (#316); #320's uncommitted demo-store migration must take the next free
-- number when it lands.
ALTER TABLE products
    ADD COLUMN metal_sibling_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
    ADD CONSTRAINT products_metal_sibling_not_self CHECK (metal_sibling_id IS NULL OR metal_sibling_id <> id);

-- One partner per product.
CREATE UNIQUE INDEX products_metal_sibling_idx ON products (metal_sibling_id) WHERE metal_sibling_id IS NOT NULL;
