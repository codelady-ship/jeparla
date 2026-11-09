package az.jeparla.common.net;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Client address settings bound from {@code jeparla.client-ip.*} (env: {@code JEPARLA_TRUSTED_PROXIES}).
 *
 * @param trustedProxies comma-separated CIDR blocks of the reverse proxies allowed to report the
 *                       client address in {@code X-Forwarded-For}, e.g. {@code 172.30.0.0/24}.
 *                       Empty trusts nothing: the TCP peer is always the client.
 */
@ConfigurationProperties("jeparla.client-ip")
public record ClientIpProperties(String trustedProxies) {

    public ClientIpProperties {
        // A malformed entry stops the startup instead of silently trusting less (or more).
        TrustedProxies.parse(trustedProxies);
    }

    public TrustedProxies proxies() {
        return TrustedProxies.parse(trustedProxies);
    }
}
