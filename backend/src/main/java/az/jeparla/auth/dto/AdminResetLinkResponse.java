package az.jeparla.auth.dto;

import java.time.Instant;

/**
 * A password reset link an admin hands to a phone-only seller (#131, until SMS is decided in #52). Shown once:
 * only its hash is stored.
 *
 * @param url       absolute link to the reset page, with the token in the fragment
 * @param expiresAt when it stops working (1 hour)
 */
public record AdminResetLinkResponse(String url, Instant expiresAt) {

    @Override
    public String toString() {
        return "AdminResetLinkResponse[url=***, expiresAt=" + expiresAt + "]";
    }
}
