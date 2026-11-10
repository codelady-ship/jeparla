package az.jeparla.common.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * The S3-compatible storage of product photos: Cloudflare R2 in production, MinIO locally. Files never pass
 * through the API (#39, #154):
 *
 * <ol>
 *   <li>the browser uploads to a presigned URL in the <b>private</b> bucket, under
 *       {@value #STAGING_PREFIX}{@code <key>}; nobody can read it from there;</li>
 *   <li>the API checks the staged object (size, type, the first bytes) and only then
 *       {@link #publishStaged publishes} it: a copy to the public bucket under {@code <key>}, after which
 *       the staged copy is deleted;</li>
 *   <li>a file that is never attached stays private and is deleted by the cleanup job (and by the
 *       bucket's lifecycle rule on {@value #STAGING_PREFIX}).</li>
 * </ol>
 *
 * <p>Keys are the public keys ({@code products/<store>/<product>/<uuid>.<ext>}); the staging prefix is
 * added by the implementation.
 */
public interface ObjectStorage {

    /** Prefix of uploads waiting for their check in the private bucket. */
    String STAGING_PREFIX = "staging/";

    /**
     * A URL the browser PUTs exactly one file to (the staging area), valid for {@code ttl}. Content type and
     * length are part of the signature: the upload must send the same {@code Content-Type} and exactly
     * {@code sizeBytes} bytes.
     */
    PresignedUpload presignStagedUpload(String key, String contentType, long sizeBytes, Duration ttl);

    /** Size and content type of a staged upload, or empty when there is none. */
    Optional<StoredObject> headStaged(String key);

    /** The first bytes of a staged upload, at most {@code maxBytes} (a ranged GET). */
    byte[] readStagedStart(String key, int maxBytes);

    /**
     * Copies a checked staged upload to the public bucket under the same key, then deletes the staged copy
     * (best effort: a staged copy left behind is private and removed by the cleanup).
     */
    void publishStaged(String key);

    /** Removes a staged upload; nothing happens when it does not exist. */
    void deleteStaged(String key);

    /** Removes a public object; nothing happens when it does not exist. */
    void delete(String key);

    /** A presigned upload: the browser sends {@code method} to {@code url} with {@code headers}. */
    record PresignedUpload(String url, String method, Map<String, String> headers, Instant expiresAt) {
    }

    record StoredObject(long sizeBytes, String contentType) {
    }
}
