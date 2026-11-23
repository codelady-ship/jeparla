-- A bijouterie or handmade seller (seller_kind FASHION, #128) may apply without a VOEN (#317): many craftspeople
-- have none. A store that sells precious jewelry (PRECIOUS, MIXED) still needs it; the API checks that on the
-- application and when the seller kind changes. The format check of V3 still applies when a VOEN is given.

ALTER TABLE stores
    ALTER COLUMN tax_id DROP NOT NULL,
    ADD CONSTRAINT stores_tax_id_precious CHECK (tax_id IS NOT NULL OR seller_kind = 'FASHION');
