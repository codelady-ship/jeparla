package az.jeparla.common.error;

import org.springframework.http.HttpStatus;

/** 429 Too Many Requests; the response carries {@code Retry-After} in seconds. */
public class RateLimitExceededException extends ApiException {

    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, "rate_limited");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
