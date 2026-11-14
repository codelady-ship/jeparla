-- Studio look (#119): a seller's own photo cleaned up to the catalog standard (background removed, cream
-- background, centred, soft shadow, 4:5) as an AI Studio job of kind STUDIO_LOOK. The original photo is never
-- changed; the result becomes an extra photo only after the seller approves it.
--
-- ai_assets.ai_generated: whether the processor that made the file was generative. Background removal is not:
-- such a photo is published without the "AI ilə yaradılıb" label (CLAUDE.md honesty rule applies to generated or
-- generatively edited images). Recorded per file, so a change of the processor between processing and approval
-- cannot drop the label.

ALTER TABLE ai_jobs
    DROP CONSTRAINT ai_jobs_kind,
    ADD CONSTRAINT ai_jobs_kind CHECK (kind IN ('AI_PHOTOSHOOT', 'VIRTUAL_TRY_ON', 'STUDIO_LOOK'));

ALTER TABLE ai_assets
    ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT TRUE;
