-- Shareable catalog link of a store (#100): jeparla.az/s/<share_code> for Instagram, TikTok, WhatsApp and
-- Tap.az, and the referral counters behind the merchant's "where did my visitors come from" statistics.

-- A share code is 8 characters of an alphabet without look-alikes (no 0/o, 1/l), the same as the slug
-- suffixes of Slugs.withSuffix: 32^8 ~ 1.1e12 codes, so they are not guessed by counting. It is independent
-- of the slug: the merchant can replace it (an old printed QR code then stops working) without changing
-- the store URL. Random bytes come from gen_random_uuid() (core PostgreSQL, cryptographically strong):
-- bytes 0-5 and 10-11 of a version 4 UUID are fully random, and 256 is a multiple of 32, so every
-- character is uniform.
CREATE FUNCTION jeparla_new_share_code() RETURNS TEXT
    LANGUAGE plpgsql
    VOLATILE
AS
$$
DECLARE
    alphabet CONSTANT TEXT := 'abcdefghijkmnpqrstuvwxyz23456789';
    bytes             BYTEA := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code              TEXT := '';
    i                 INTEGER;
BEGIN
    FOREACH i IN ARRAY ARRAY [0, 1, 2, 3, 4, 5, 10, 11]
        LOOP
            code := code || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
        END LOOP;
    RETURN code;
END;
$$;

-- Existing stores get a code here; new ones get it from the API (Store constructor) or, for SQL inserts
-- such as the demo seed, from the default.
ALTER TABLE stores
    ADD COLUMN share_code TEXT;
UPDATE stores
SET share_code = jeparla_new_share_code();
ALTER TABLE stores
    ALTER COLUMN share_code SET DEFAULT jeparla_new_share_code(),
    ALTER COLUMN share_code SET NOT NULL,
    ADD CONSTRAINT stores_share_code_key UNIQUE (share_code),
    ADD CONSTRAINT stores_share_code_format CHECK (share_code ~ '^[a-km-np-z2-9]{8}$');

-- Visits that arrived through a shared link or a link with ?ref= / ?utm_source=, and the WhatsApp clicks
-- those visitors made, per store, business day (Asia/Baku) and source. Aggregated counters only: no IP
-- address, no user agent, no user id, no visit row. Bots and link-preview crawlers are not counted; the
-- per-address limits that stop reloads from being counted live in Redis under SHA-256 keys and expire.
CREATE TABLE store_referral_counts
(
    store_id        BIGINT NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
    day             DATE   NOT NULL,
    source          TEXT   NOT NULL,
    visits          BIGINT NOT NULL DEFAULT 0,
    whatsapp_clicks BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (store_id, day, source),
    CONSTRAINT store_referral_counts_source CHECK (source IN (
        'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'TAPAZ', 'FACEBOOK', 'TELEGRAM', 'YOUTUBE', 'QR', 'LINK', 'OTHER')),
    CONSTRAINT store_referral_counts_counts CHECK (visits >= 0 AND whatsapp_clicks >= 0)
);
