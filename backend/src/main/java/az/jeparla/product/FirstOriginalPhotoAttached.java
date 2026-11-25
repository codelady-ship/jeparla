package az.jeparla.product;

/**
 * A product got its first original (not AI-generated) photo (#121). Published inside the attach transaction; a
 * listener may queue an on-model image after the commit (off by default, {@code jeparla.ai.auto-try-on}).
 *
 * @param tryOnModelId the AI model the seller picked for this photo at upload, or null when none was picked: then
 *                     only the automatic try-on (if on) runs, with the default model
 */
public record FirstOriginalPhotoAttached(long productId, long imageId, Long tryOnModelId) {
}
