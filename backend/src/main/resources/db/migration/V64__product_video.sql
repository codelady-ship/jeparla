-- One short product video (#117): a clip of up to 15 seconds the buyer starts on the product page.
--
-- At most one per product, so it is a set of columns on products, not a table: the catalog card only asks
-- "is there a video" and the product page reads it with the product row, with no extra query. The seller
-- uploads it like a photo (presigned PUT into the private staging area); the API reads the container header
-- of the staged file (MP4 with H.264, or WebM), checks type, size and duration, and only then copies it to
-- the public bucket. Nothing is transcoded.

ALTER TABLE products
    -- Object key in the public bucket, as product_images.storage_key.
    ADD COLUMN video_key          TEXT,
    ADD COLUMN video_content_type TEXT,
    ADD COLUMN video_size_bytes   BIGINT,
    ADD COLUMN video_duration_ms  INTEGER,
    ADD COLUMN video_width        INTEGER,
    ADD COLUMN video_height       INTEGER,
    -- Generated or edited with AI: shown with a visible "AI" label (CLAUDE.md, honesty).
    ADD COLUMN video_ai_generated BOOLEAN,
    ADD CONSTRAINT products_video_key_key UNIQUE (video_key),
    ADD CONSTRAINT products_video_all_or_none CHECK (
        (video_key IS NULL AND video_content_type IS NULL AND video_size_bytes IS NULL
            AND video_duration_ms IS NULL AND video_width IS NULL AND video_height IS NULL
            AND video_ai_generated IS NULL)
        OR (video_key IS NOT NULL AND video_content_type IS NOT NULL AND video_size_bytes IS NOT NULL
            AND video_duration_ms IS NOT NULL AND video_width IS NOT NULL AND video_height IS NOT NULL
            AND video_ai_generated IS NOT NULL)),
    ADD CONSTRAINT products_video_content_type CHECK (video_content_type IN ('video/mp4', 'video/webm')),
    -- 8 MB and 15 s (plus the rounding slack of a container header) are the limits of the upload check.
    ADD CONSTRAINT products_video_size CHECK (video_size_bytes > 0 AND video_size_bytes <= 8388608),
    ADD CONSTRAINT products_video_duration CHECK (video_duration_ms > 0 AND video_duration_ms <= 15500),
    ADD CONSTRAINT products_video_dimensions CHECK (video_width > 0 AND video_height > 0);

-- The video quota of a store counts its live products with a video.
CREATE INDEX products_store_video_idx ON products (store_id) WHERE video_key IS NOT NULL AND deleted_at IS NULL;

-- Presigned uploads: a video upload is its own kind and takes no place of the 8 gallery photos.
ALTER TABLE image_upload_slots
    DROP CONSTRAINT image_upload_slots_kind,
    ADD CONSTRAINT image_upload_slots_kind CHECK (kind IN ('GALLERY', 'HALLMARK', 'TAG', 'VIDEO'));
