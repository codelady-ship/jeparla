-- Public catalog API (#37).

-- WhatsApp contact clicks per product and day (POST /api/v1/products/{id}/contact-click). The merchant
-- dashboard (PLAN 5.7) and the v1 commission model (PLAN 4) read these counters. No personal data:
-- no IP address, no user id, only a counter.
CREATE TABLE product_contact_clicks
(
    product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    -- Business day in Asia/Baku.
    day        DATE   NOT NULL,
    clicks     BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, day),
    CONSTRAINT product_contact_clicks_clicks CHECK (clicks >= 0)
);

-- Image URLs are JEPARLA_S3_PUBLIC_URL + "/" + key. Only the demo seed may put a URL fragment in a
-- key (it reuses 16 photos for unique keys, "demo/ring-gold-1.jpg#12-0"); the API drops it and
-- serves demo keys from the frontend /demo folder. Any other key with '#' would break the URL.
ALTER TABLE product_images
    ADD CONSTRAINT product_images_storage_key_fragment
        CHECK (position('#' IN storage_key) = 0 OR storage_key LIKE 'demo/%');

ALTER TABLE stores
    ADD CONSTRAINT stores_logo_key_fragment
        CHECK (logo_key IS NULL OR position('#' IN logo_key) = 0 OR logo_key LIKE 'demo/%');
