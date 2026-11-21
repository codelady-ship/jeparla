package az.jeparla.product;

/**
 * The short video of a product in the public bucket (#117, V64): at most one, an MP4 (H.264) or WebM of up to 15
 * seconds and 8 MB that was checked when it was uploaded. Only the object key is stored; the URL is built
 * from {@code JEPARLA_S3_PUBLIC_URL}. An AI-generated or AI-edited video carries a visible label (CLAUDE.md,
 * honesty).
 */
public record ProductVideo(String storageKey, String contentType, long sizeBytes, int durationMs, int width,
        int height, boolean aiGenerated) {
}
