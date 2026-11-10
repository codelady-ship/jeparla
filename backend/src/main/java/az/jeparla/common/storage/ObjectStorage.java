package az.jeparla.common.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * The public bucket (product images) of the S3-compatible storage: Cloudflare R2 in production, MinIO
 * locally. Files never pass through the API: the browser uploads to a presigned URL, then the API checks
 * the stored object (size, type, the first bytes) before it is used (#39).
 */
public interface ObjectStorage {

    /**
     * A URL the browser PUTs exactly one file to, valid for {@code ttl}. Content type and length are part of
     * the signature: the upload must send the same {@code Content-Type} and exactly {@code sizeBytes} bytes.
     */
    PresignedUpload presignUpload(String key, String contentType, long sizeBytes, Duration ttl);

    /** Size and content type of a stored object, or empty when there is none. */
    Optional<StoredObject> head(String key);

    /** The first bytes of an object, at most {@code maxBytes} (a ranged GET). */
    byte[] readStart(String key, int maxBytes);

    /** Removes an object; nothing happens when it does not exist. */
    void delete(String key);

    /** A presigned upload: the browser sends {@code method} to {@code url} with {@code headers}. */
    record PresignedUpload(String url, String method, Map<String, String> headers, Instant expiresAt) {
    }

    record StoredObject(long sizeBytes, String contentType) {
    }
}
