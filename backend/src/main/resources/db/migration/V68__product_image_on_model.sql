-- On-model photos (#315, review of #336): an approved VIRTUAL_TRY_ON result becomes a product photo with
-- on_model = true and the library model it shows (ai_model_id, null for the prompt's default model). Only these
-- photos are offered behind "Modeldə bax" and the model switcher; an approved AI_PHOTOSHOOT result or a photo the
-- seller marked as AI-edited stays aiGenerated without on_model. A model is never deleted, only deactivated, so
-- SET NULL applies only to a manual removal.
--
-- Migration numbers of the open on-model PRs: V68 this, V69 the AI review index (#337), V70 metal siblings.
-- #320's uncommitted demo-store migration must take the next free number.
ALTER TABLE product_images
    ADD COLUMN on_model    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN ai_model_id BIGINT REFERENCES ai_models (id) ON DELETE SET NULL,
    ADD CONSTRAINT product_images_on_model_ai CHECK (NOT on_model OR ai_generated),
    ADD CONSTRAINT product_images_model_on_model CHECK (ai_model_id IS NULL OR on_model);
