-- Seller code of conduct v2 and versioned seller terms (#107, #249; docs/legal/analysis.md risk 4).
--
-- 1. seller_terms_versions: the seller terms (/legal/sellers) get their own version, like the code (V51). The text
--    lives in frontend/src/content/legal; a new wording gets a new row here and SellerCode.CURRENT_TERMS_VERSION.
-- 2. Code version 2 adds the consumer-rights clause (Verified.code.8). Every store accepts it again: an acceptance
--    of version 1 is no longer valid (SellerCode.isAccepted).
-- 3. Each acceptance records both versions; the store row keeps the latest pair. Acceptances made before this
--    migration have no terms version (NULL): they were made under the code only.

CREATE TABLE seller_terms_versions
(
    version      INT PRIMARY KEY,
    published_on DATE NOT NULL,
    CONSTRAINT seller_terms_versions_version CHECK (version > 0)
);

INSERT INTO seller_terms_versions (version, published_on)
VALUES (1, DATE '2026-11-16');

INSERT INTO seller_code_versions (version, published_on)
VALUES (2, DATE '2026-11-16');

ALTER TABLE store_code_acceptances
    ADD COLUMN terms_version INT REFERENCES seller_terms_versions (version);

ALTER TABLE stores
    ADD COLUMN terms_version INT REFERENCES seller_terms_versions (version),
    ADD CONSTRAINT stores_terms_with_code CHECK (terms_version IS NULL OR code_version IS NOT NULL);
