-- Seller identification on the store page (ET art. 5.3, #249, docs/legal/analysis.md section 3).
--
-- The registered name of the seller (company name or the sole trader's name as in the tax registration), written by
-- the seller in the cabinet. When it is set, the store page shows it with the legal form and the VOEN (tax_id,
-- already required, V3); when it is not, the page shows none of them. NULL: not provided.

ALTER TABLE stores
    ADD COLUMN legal_name TEXT,
    ADD CONSTRAINT stores_legal_name CHECK (legal_name IS NULL OR length(btrim(legal_name)) BETWEEN 2 AND 200);
