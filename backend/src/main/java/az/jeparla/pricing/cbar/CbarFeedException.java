package az.jeparla.pricing.cbar;

/**
 * The CBAR bulletin could not be fetched or did not pass validation. Nothing from it is stored: the
 * last good quote stays in use.
 */
public class CbarFeedException extends RuntimeException {

    private final boolean retryable;

    public CbarFeedException(String message, boolean retryable) {
        this(message, retryable, null);
    }

    public CbarFeedException(String message, boolean retryable, Throwable cause) {
        super(message, cause);
        this.retryable = retryable;
    }

    /** A network error, timeout, 5xx or 429: another try may succeed. Format errors are not retried. */
    public boolean isRetryable() {
        return retryable;
    }
}
