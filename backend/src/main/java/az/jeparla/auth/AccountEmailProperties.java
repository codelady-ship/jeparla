package az.jeparla.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Email verification and password reset settings (#131), bound from {@code jeparla.auth.account-email.*}.
 *
 * @param verificationTtl     life of an email verification link
 * @param resetTtl            life of a password reset link (also one an admin issues)
 * @param forgotResponseFloor every "forgot password" request takes at least this long, so the answer time does
 *                            not tell whether an account exists (the email is only written for one that does)
 */
@ConfigurationProperties("jeparla.auth.account-email")
public record AccountEmailProperties(
        @DefaultValue("24h") Duration verificationTtl,
        @DefaultValue("1h") Duration resetTtl,
        @DefaultValue("400ms") Duration forgotResponseFloor) {

    public AccountEmailProperties {
        requirePositive(verificationTtl, "verification-ttl");
        requirePositive(resetTtl, "reset-ttl");
        if (forgotResponseFloor == null || forgotResponseFloor.isNegative()
                || forgotResponseFloor.compareTo(Duration.ofSeconds(5)) > 0) {
            throw new IllegalArgumentException("jeparla.auth.account-email.forgot-response-floor must be 0..5s");
        }
    }

    private static void requirePositive(Duration value, String name) {
        if (value == null || value.isNegative() || value.isZero()) {
            throw new IllegalArgumentException("jeparla.auth.account-email." + name + " must be positive");
        }
    }
}
