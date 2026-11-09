package az.jeparla.common.config;

import java.net.URI;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * CORS settings bound from {@code jeparla.cors.*} (env: {@code JEPARLA_FRONTEND_ORIGIN}).
 *
 * @param allowedOrigins exact frontend origins, e.g. {@code https://jeparla.az}. Wildcards are
 *                       rejected so the API is never open to every site.
 */
@ConfigurationProperties("jeparla.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        if (allowedOrigins == null || allowedOrigins.isEmpty()) {
            throw new IllegalArgumentException("jeparla.cors.allowed-origins (JEPARLA_FRONTEND_ORIGIN) must be set");
        }
        allowedOrigins = allowedOrigins.stream().map(String::trim).filter(o -> !o.isEmpty()).toList();
        if (allowedOrigins.isEmpty()) {
            throw new IllegalArgumentException("jeparla.cors.allowed-origins (JEPARLA_FRONTEND_ORIGIN) must be set");
        }
        allowedOrigins.forEach(CorsProperties::requireExactOrigin);
    }

    private static void requireExactOrigin(String origin) {
        if (origin.contains("*")) {
            throw new IllegalArgumentException("Wildcard CORS origin is not allowed: " + origin);
        }
        URI uri;
        try {
            uri = URI.create(origin);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid CORS origin: " + origin, e);
        }
        boolean http = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
        boolean bare = uri.getHost() != null
                && (uri.getRawPath() == null || uri.getRawPath().isEmpty())
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null
                && uri.getRawUserInfo() == null;
        if (!http || !bare) {
            throw new IllegalArgumentException(
                    "CORS origin must be scheme://host[:port] without a path, e.g. https://jeparla.az: " + origin);
        }
    }
}
