-- Every foreign key states its delete rule (MigrationTests.everyForeignKeyStatesItsDeleteRule).
-- V51 and V58 left it out on the seller code and terms versions. A published version is evidence of
-- what a store accepted: it is never deleted while a store or an acceptance points to it (RESTRICT,
-- the same behaviour as before, now explicit).
ALTER TABLE store_code_acceptances
    DROP CONSTRAINT store_code_acceptances_version_fkey,
    ADD CONSTRAINT store_code_acceptances_version_fkey
        FOREIGN KEY (version) REFERENCES seller_code_versions (version) ON DELETE RESTRICT,
    DROP CONSTRAINT store_code_acceptances_terms_version_fkey,
    ADD CONSTRAINT store_code_acceptances_terms_version_fkey
        FOREIGN KEY (terms_version) REFERENCES seller_terms_versions (version) ON DELETE RESTRICT;

ALTER TABLE stores
    DROP CONSTRAINT stores_code_version_fkey,
    ADD CONSTRAINT stores_code_version_fkey
        FOREIGN KEY (code_version) REFERENCES seller_code_versions (version) ON DELETE RESTRICT,
    DROP CONSTRAINT stores_terms_version_fkey,
    ADD CONSTRAINT stores_terms_version_fkey
        FOREIGN KEY (terms_version) REFERENCES seller_terms_versions (version) ON DELETE RESTRICT;
