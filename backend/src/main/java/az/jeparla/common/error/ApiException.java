package az.jeparla.common.error;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * An expected API error with a stable machine-readable {@code code} (e.g.
 * {@code auth.invalid_credentials}). {@link GlobalExceptionHandler} turns it into a ProblemDetail:
 * {@code title} by status, {@code detail} from the message {@code error.<code>} in the request
 * language, a {@code code} property, and an {@code errors} entry when the error belongs to a field.
 * The exception message is for logs only and never reaches the client.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String field;
    private final transient HttpHeaders headers = new HttpHeaders();
    private transient Object[] args;

    public ApiException(HttpStatus status, String code) {
        this(status, code, null);
    }

    public ApiException(HttpStatus status, String code, String field) {
        super(code);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    /** Adds a response header, e.g. a {@code Set-Cookie} that clears a cookie. Returns this exception. */
    public ApiException withHeader(String name, String value) {
        headers.add(name, value);
        return this;
    }

    /**
     * Arguments of the localized detail ({@code {0}} ... in {@code error.<code>}), e.g. the phrase that
     * triggered the error. Returns this exception.
     */
    public ApiException withArgs(Object... args) {
        this.args = args.clone();
        return this;
    }

    /** Arguments of the localized detail, or null. */
    public Object[] args() {
        return args == null ? null : args.clone();
    }

    /** Extra response headers. */
    public HttpHeaders headers() {
        return headers;
    }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found");
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    /** Request field the error belongs to, or null. */
    public String field() {
        return field;
    }

    /** Message key of the localized detail. */
    public String messageKey() {
        return "error." + code;
    }
}
