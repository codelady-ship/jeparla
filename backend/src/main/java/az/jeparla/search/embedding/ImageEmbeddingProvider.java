package az.jeparla.search.embedding;

/**
 * Turns a jewelry photo into a visual embedding for search by photo (#163). Provider-neutral: the intended
 * implementation is an open-licence CLIP/SigLIP model run on the API's own CPU (ONNX), never a paid external API
 * (docs/image-search.md). Without one, {@link DisabledImageEmbeddingProvider} is active and search by photo
 * answers 503 {@code search.image_not_configured}.
 *
 * <p>Embeddings are similarity vectors, not money or weight, so {@code float} is the right type here (the
 * NUMERIC/BigDecimal rule of CLAUDE.md is about prices and grams). Implementations must not store or log the
 * image bytes they are given.
 */
public interface ImageEmbeddingProvider {

    /** Value of {@code jeparla.search.image.provider} that selects this provider. */
    String id();

    /** True when the model is loaded and can embed. */
    boolean configured();

    /**
     * Name and version of the model, e.g. {@code siglip-base-patch16-224@<sha256 prefix>}: embeddings of another
     * model are never compared with this one's.
     */
    String model();

    /**
     * Embedding of an image already checked by the caller (JPEG, PNG or WebP, within the size limit).
     *
     * @throws ImageEmbeddingException when the model cannot read the image or fails
     */
    float[] embed(byte[] image, String contentType);

    /**
     * Below this cosine a catalog photo is not "similar" at all: an empty answer beats a random one. Depends on
     * the model (how far apart unrelated photos land), so each provider states its own.
     */
    default double minSimilarity() {
        return 0.2;
    }
}
