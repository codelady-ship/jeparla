package az.jeparla.product;

/**
 * A product got its first original (not AI-generated) photo (#121). Published inside the attach transaction; a
 * listener may queue an on-model image after the commit (off by default, {@code jeparla.ai.auto-try-on}).
 */
public record FirstOriginalPhotoAttached(long productId, long imageId) {
}
