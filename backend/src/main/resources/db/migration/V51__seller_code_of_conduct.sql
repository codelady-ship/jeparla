-- Seller code of conduct (#107). The text lives in the frontend message files (Verified.code);
-- a new wording gets a new version here, and every store accepts it again.
CREATE TABLE seller_code_versions
(
    version      INT  PRIMARY KEY,
    published_on DATE NOT NULL,
    CONSTRAINT seller_code_versions_version CHECK (version > 0)
);

INSERT INTO seller_code_versions (version, published_on) VALUES (1, DATE '2026-11-15');

-- Every acceptance (the wizard and the yearly confirmation in the cabinet), kept for the audit.
CREATE TABLE store_code_acceptances
(
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    store_id    BIGINT      NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
    version     INT         NOT NULL REFERENCES seller_code_versions (version),
    accepted_at TIMESTAMPTZ NOT NULL,
    accepted_by BIGINT      REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX store_code_acceptances_store_idx ON store_code_acceptances (store_id, accepted_at DESC);

-- The latest acceptance, read on every submission to review and on the store page.
ALTER TABLE stores
    ADD COLUMN code_version     INT REFERENCES seller_code_versions (version),
    ADD COLUMN code_accepted_at TIMESTAMPTZ,
    ADD CONSTRAINT stores_code_acceptance_pair
        CHECK ((code_version IS NULL) = (code_accepted_at IS NULL));
