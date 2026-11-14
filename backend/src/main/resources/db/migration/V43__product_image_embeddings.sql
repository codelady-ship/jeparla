-- Search by photo (#163): one visual embedding per product photo and embedding model. Plain REAL[] instead of
-- pgvector: the postgres:16-alpine image has no vector extension, and a catalog of a few thousand photos is
-- compared in the API (cosine) fast enough. Moving to pgvector (an HNSW index) is a later migration
-- (docs/image-search.md). A photo deleted with its product or by the seller takes its embedding with it.
-- The buyer's query photo is never stored.

CREATE TABLE product_image_embeddings
(
    image_id   BIGINT      NOT NULL REFERENCES product_images (id) ON DELETE CASCADE,
    model      TEXT        NOT NULL,
    embedding  REAL[]      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (image_id, model),
    CONSTRAINT product_image_embeddings_model CHECK (length(model) BETWEEN 1 AND 120),
    CONSTRAINT product_image_embeddings_size CHECK (cardinality(embedding) BETWEEN 1 AND 4096)
);

CREATE INDEX product_image_embeddings_model_idx ON product_image_embeddings (model);
