package az.jeparla.common.storage;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Public object storage settings bound from {@code jeparla.storage.*}.
 *
 * @param publicUrl base URL browsers use for public images ({@code JEPARLA_S3_PUBLIC_URL}, e.g.
 *                  {@code https://img.jeparla.az} or {@code http://localhost:9000/jeparla-public}).
 *                  Optional while only demo images exist; a trailing slash is dropped.
 */
@ConfigurationProperties("jeparla.storage")
public record StorageProperties(String publicUrl) {

    public StorageProperties {
        publicUrl = publicUrl == null || publicUrl.isBlank() ? null : stripTrailingSlash(publicUrl.trim());
        if (publicUrl != null) {
            requireHttpUrl(publicUrl);
        }
    }

    private static String stripTrailingSlash(String url) {
        String result = url;
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private static void requireHttpUrl(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("jeparla.storage.public-url (JEPARLA_S3_PUBLIC_URL) is not a URL", e);
        }
        boolean http = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
        if (!http || uri.getHost() == null || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException(
                    "jeparla.storage.public-url (JEPARLA_S3_PUBLIC_URL) must be an http(s) URL without query or fragment");
        }
    }
}
