package az.jeparla.search.embedding;

/** No model installed (the default): search by photo is shown as "not available yet", never with sample results. */
public final class DisabledImageEmbeddingProvider implements ImageEmbeddingProvider {

    public static final String ID = "none";

    @Override
    public String id() {
        return ID;
    }

    @Override
    public boolean configured() {
        return false;
    }

    @Override
    public String model() {
        return ID;
    }

    @Override
    public float[] embed(byte[] image, String contentType) {
        throw new ImageEmbeddingException("No image embedding model is configured");
    }
}
