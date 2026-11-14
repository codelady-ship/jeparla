package az.jeparla.ai;

/**
 * What a job makes (PLAN 5.12). The prompt of each kind is in {@code resources/ai/prompts/<kind>.txt}.
 */
public enum AiJobKind {
    /** The product alone in the site's studio style (cream background, soft golden light, 4:5). */
    AI_PHOTOSHOOT,
    /** The product worn by an AI model (no real person). */
    VIRTUAL_TRY_ON,
    /**
     * The seller's own photo cleaned up to the catalog standard (#119): background removed, cream background,
     * centred, soft shadow, 4:5. Runs on the studio processor ({@code jeparla.ai.studio-processor}), which does
     * not generate: the result keeps the item as photographed.
     */
    STUDIO_LOOK
}
