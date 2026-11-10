package az.jeparla.common.net;

import java.nio.charset.StandardCharsets;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Client address settings bound from {@code jeparla.client-ip.*} (env: {@code JEPARLA_TRUSTED_PROXIES},
 * {@code JEPARLA_FRONTEND_TOKEN}).
 *
 * @param trustedProxies comma-separated CIDR blocks of the reverse proxies allowed to report the
 *                       client address in {@code X-Forwarded-For}, e.g. {@code 172.30.0.0/24}.
 *                       Empty trusts nothing: the TCP peer is always the client.
 * @param frontendToken  shared secret of the Jeparla frontend server (32+ bytes). The Next.js server
 *                       calls the API for its visitors (sign-in, search, server rendering); a request
 *                       with this token in {@value ClientIpFilter#FRONTEND_TOKEN} names its visitor in
 *                       {@value ClientIpFilter#FRONTEND_CLIENT_IP}, so rate limits and the audit log
 *                       count visitors, not the frontend server (#41). Empty: both headers are ignored.
 */
@ConfigurationProperties("jeparla.client-ip")
public record ClientIpProperties(String trustedProxies, String frontendToken) {

    static final int MIN_TOKEN_BYTES = 32;

    public ClientIpProperties {
        // A malformed entry stops the startup instead of silently trusting less (or more).
        TrustedProxies.parse(trustedProxies);
        frontendToken = frontendToken == null || frontendToken.isBlank() ? null : frontendToken.strip();
        if (frontendToken != null && frontendToken.getBytes(StandardCharsets.UTF_8).length < MIN_TOKEN_BYTES) {
            throw new IllegalArgumentException("jeparla.client-ip.frontend-token (JEPARLA_FRONTEND_TOKEN) must be "
                    + "at least " + MIN_TOKEN_BYTES + " bytes");
        }
    }

    public ClientIpProperties(String trustedProxies) {
        this(trustedProxies, null);
    }

    public TrustedProxies proxies() {
        return TrustedProxies.parse(trustedProxies);
    }
}
