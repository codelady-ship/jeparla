-- On-model photos (#315, review of #336): an approved VIRTUAL_TRY_ON result becomes a product photo with
-- on_model = true and the library model it shows (ai_model_id, null for the prompt's default model). Only these
-- photos are offered behind "Modeldə bax" and the model switcher; an approved AI_PHOTOSHOOT result or a photo the
-- seller marked as AI-edited stays aiGenerated without on_model. A model is never deleted, only deactivated, so
-- SET NULL applies only to a manual removal.
--
-- Skin tone variants (owner decision 2026-11-25, the 3-models PR): a try-on job may ask for one of the five tones
-- of ai_models.skin_tone (ai_jobs.skin_tone, null: the model as it is), and the approved photo keeps it
-- (product_images.skin_tone) so the product page can offer the approved tones of each model. Same column type and
-- check as V41, so this is the only migration the on-model work needs.
--
-- Migration numbers of the open on-model PRs: V68 this, V69 the AI review index (#337), V70 metal siblings.
-- #320's uncommitted demo-store migration must take the next free number.
ALTER TABLE product_images
    ADD COLUMN on_model    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN ai_model_id BIGINT REFERENCES ai_models (id) ON DELETE SET NULL,
    ADD COLUMN skin_tone   TEXT,
    ADD CONSTRAINT product_images_on_model_ai CHECK (NOT on_model OR ai_generated),
    ADD CONSTRAINT product_images_model_on_model CHECK (ai_model_id IS NULL OR on_model),
    ADD CONSTRAINT product_images_skin_tone CHECK (skin_tone IS NULL OR (on_model
        AND skin_tone IN ('LIGHT', 'MEDIUM_LIGHT', 'MEDIUM', 'MEDIUM_DARK', 'DARK')));

ALTER TABLE ai_jobs
    ADD COLUMN skin_tone TEXT,
    ADD CONSTRAINT ai_jobs_skin_tone CHECK (skin_tone IS NULL OR (kind = 'VIRTUAL_TRY_ON'
        AND skin_tone IN ('LIGHT', 'MEDIUM_LIGHT', 'MEDIUM', 'MEDIUM_DARK', 'DARK')));
