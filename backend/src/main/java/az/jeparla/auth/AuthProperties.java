package az.jeparla.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Authentication settings bound from {@code jeparla.auth.*}.
 *
 * @param jwtSecret       HMAC-SHA256 signing key of the access tokens (env {@code JEPARLA_JWT_SECRET}).
 *                        At least {@value #MIN_SECRET_BYTES} bytes; the application does not start
 *                        without it. Never logged.
 * @param accessTokenTtl  lifetime of an access token (short: it cannot be revoked)
 * @param refreshTokenTtl lifetime of a refresh token; every refresh issues a new one
 * @param cookieSecure    {@code Secure} flag of the refresh cookie (env {@code JEPARLA_COOKIE_SECURE}).
 *                        Keep {@code true}: browsers accept Secure cookies on http://localhost too.
 */
@ConfigurationProperties("jeparla.auth")
public record AuthProperties(
        String jwtSecret,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("30d") Duration refreshTokenTtl,
        @DefaultValue("true") boolean cookieSecure) {

    /** 256 bits: the key size of HS256 (RFC 7518, section 3.2). */
    public static final int MIN_SECRET_BYTES = 32;

    public AuthProperties {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalArgumentException("jeparla.auth.jwt-secret (JEPARLA_JWT_SECRET) must be set");
        }
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalArgumentException("jeparla.auth.jwt-secret (JEPARLA_JWT_SECRET) must be at least "
                    + MIN_SECRET_BYTES + " bytes, e.g. the output of `openssl rand -hex 32`");
        }
        requirePositive(accessTokenTtl, "access-token-ttl");
        requirePositive(refreshTokenTtl, "refresh-token-ttl");
        if (refreshTokenTtl.compareTo(accessTokenTtl) <= 0) {
            throw new IllegalArgumentException("jeparla.auth.refresh-token-ttl must be longer than access-token-ttl");
        }
    }

    private static void requirePositive(Duration value, String name) {
        if (value == null || value.isNegative() || value.isZero()) {
            throw new IllegalArgumentException("jeparla.auth." + name + " must be positive");
        }
    }

    /** The secret never appears in logs or failure analysis output. */
    @Override
    public String toString() {
        return "AuthProperties[jwtSecret=***, accessTokenTtl=" + accessTokenTtl + ", refreshTokenTtl="
                + refreshTokenTtl + ", cookieSecure=" + cookieSecure + "]";
    }
}
