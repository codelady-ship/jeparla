-- Product page details (#174): optional sizes in millimetres and up to five key features the seller
-- writes; the store's own services (its statement, not a Jeparla guarantee) and its return terms.
ALTER TABLE products
    ADD COLUMN width_mm     NUMERIC(6, 2),
    ADD COLUMN thickness_mm NUMERIC(6, 2),
    ADD COLUMN length_mm    NUMERIC(6, 2),
    ADD COLUMN diameter_mm  NUMERIC(6, 2),
    ADD COLUMN key_features TEXT,
    ADD CONSTRAINT products_dimensions_positive CHECK (
        (width_mm IS NULL OR width_mm > 0)
            AND (thickness_mm IS NULL OR thickness_mm > 0)
            AND (length_mm IS NULL OR length_mm > 0)
            AND (diameter_mm IS NULL OR diameter_mm > 0)),
    ADD CONSTRAINT products_key_features_length CHECK (char_length(key_features) <= 700);

ALTER TABLE stores
    ADD COLUMN service_resize    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN service_engraving BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN service_gift_wrap BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN service_delivery  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN service_returns   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN return_policy     TEXT,
    ADD CONSTRAINT stores_return_policy_length CHECK (char_length(return_policy) <= 500);
