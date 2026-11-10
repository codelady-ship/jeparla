package az.jeparla.common.storage;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * S3-compatible storage bound from {@code jeparla.storage.s3.*} (Cloudflare R2 in production, MinIO
 * locally). All values come from the environment; without endpoint, keys and bucket, uploads answer 503
 * and the rest of the API works.
 *
 * @param endpoint        API endpoint the backend calls ({@code JEPARLA_S3_ENDPOINT}, e.g.
 *                        {@code http://minio:9000} or {@code https://<account>.r2.cloudflarestorage.com})
 * @param presignEndpoint endpoint written into presigned URLs, reachable from the browser
 *                        ({@code JEPARLA_S3_PRESIGN_ENDPOINT}); empty means {@code endpoint}. Locally the API
 *                        container reaches {@code minio:9000} but the browser {@code localhost:9000}
 * @param region          signing region ({@code JEPARLA_S3_REGION}; R2 uses {@code auto})
 * @param accessKey       {@code JEPARLA_S3_ACCESS_KEY}
 * @param secretKey       {@code JEPARLA_S3_SECRET_KEY}
 * @param publicBucket    bucket of the product images ({@code JEPARLA_S3_PUBLIC_BUCKET})
 */
@ConfigurationProperties("jeparla.storage.s3")
public record S3Properties(String endpoint, String presignEndpoint, String region, String accessKey,
        String secretKey, String publicBucket) {

    public S3Properties {
        endpoint = blankToNull(endpoint);
        presignEndpoint = blankToNull(presignEndpoint);
        region = blankToNull(region) == null ? "us-east-1" : region.trim();
        accessKey = blankToNull(accessKey);
        secretKey = blankToNull(secretKey);
        publicBucket = blankToNull(publicBucket);
        if (endpoint != null) {
            requireHttpUrl(endpoint, "JEPARLA_S3_ENDPOINT");
        }
        if (presignEndpoint != null) {
            requireHttpUrl(presignEndpoint, "JEPARLA_S3_PRESIGN_ENDPOINT");
        }
    }

    /** Endpoint, keys and bucket are all set. */
    public boolean configured() {
        return endpoint != null && accessKey != null && secretKey != null && publicBucket != null;
    }

    /** Endpoint of presigned URLs. */
    public String browserEndpoint() {
        return presignEndpoint != null ? presignEndpoint : endpoint;
    }

    @Override
    public String toString() {
        return "S3Properties[endpoint=" + endpoint + ", presignEndpoint=" + presignEndpoint + ", region=" + region
                + ", accessKey=" + (accessKey == null ? "unset" : "***") + ", secretKey="
                + (secretKey == null ? "unset" : "***") + ", publicBucket=" + publicBucket + "]";
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static void requireHttpUrl(String url, String name) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(name + " is not a URL", e);
        }
        boolean http = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
        if (!http || uri.getHost() == null) {
            throw new IllegalArgumentException(name + " must be an http(s) URL");
        }
    }
}
