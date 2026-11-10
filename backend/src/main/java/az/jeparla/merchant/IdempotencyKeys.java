package az.jeparla.merchant;

import az.jeparla.common.error.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * The optional {@code Idempotency-Key} request header of the create endpoints: a UUID the client makes once
 * per form submit and repeats on a retry, so a double submit creates one store or product.
 */
final class IdempotencyKeys {

    static final String HEADER = "Idempotency-Key";

    private IdempotencyKeys() {
    }

    /** The key, null when the header is absent, 400 {@code merchant.idempotency_key} when it is not a UUID. */
    static UUID parse(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        try {
            UUID key = UUID.fromString(header.strip());
            if (!key.toString().equalsIgnoreCase(header.strip())) {
                throw new IllegalArgumentException("not canonical");
            }
            return key;
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.idempotency_key", HEADER);
        }
    }
}
