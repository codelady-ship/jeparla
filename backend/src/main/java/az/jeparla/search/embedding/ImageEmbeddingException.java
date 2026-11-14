package az.jeparla.search.embedding;

/** The model could not embed an image; the message never contains the image or its bytes. */
public class ImageEmbeddingException extends RuntimeException {

    public ImageEmbeddingException(String message) {
        super(message);
    }

    public ImageEmbeddingException(String message, Throwable cause) {
        super(message, cause);
    }
}
