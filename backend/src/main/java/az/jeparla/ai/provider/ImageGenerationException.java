package az.jeparla.ai.provider;

/**
 * A failed generation. {@link #code()} is stored on the job and shown to the seller (localized), so it is one of
 * a fixed set; the message is for logs only and must not contain keys or personal data.
 */
public class ImageGenerationException extends RuntimeException {

    /** The provider is switched off or has no keys. */
    public static final String NOT_CONFIGURED = "ai.not_configured";
    /** The provider refused or failed; a retry may work. */
    public static final String PROVIDER_ERROR = "ai.provider_error";
    /** The provider's content policy refused the input or the output. */
    public static final String REFUSED = "ai.provider_refused";
    /** The provider did not answer within the attempt timeout. */
    public static final String TIMEOUT = "ai.timeout";

    private final String code;

    public ImageGenerationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public ImageGenerationException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
