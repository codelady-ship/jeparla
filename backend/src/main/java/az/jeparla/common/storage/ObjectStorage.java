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

    /** Size, content type and ETag of a staged upload, or empty when there is none. */
    Optional<StoredObject> headStaged(String key);

    /**
     * The first bytes of a staged upload, at most {@code maxBytes} (a ranged GET), only while it is still the
     * object {@code checked} describes (#158: {@code If-Match} with its ETag).
     *
     * @throws StagedUploadChangedException when the staged object was replaced or removed
     */
    byte[] readStagedStart(String key, StoredObject checked, int maxBytes);

    /**
     * Copies a checked staged upload to the public bucket under the same key, then deletes the staged copy
     * (best effort: a staged copy left behind is private and removed by the cleanup). The copy happens only
     * while the staged object is still the one {@code checked} describes (#158): a file PUT again with the
     * still valid upload URL after the check is never published.
     *
     * @throws StagedUploadChangedException when the staged object was replaced or removed; nothing is copied
     */
    void publishStaged(String key, StoredObject checked);

    /** Removes a staged upload; nothing happens when it does not exist. */
    void deleteStaged(String key);

    /** Removes a public object; nothing happens when it does not exist. */
    void delete(String key);

    // ------------------------------------------------------------------ private documents (#40, #138)

    /**
     * Lowercase hex SHA-256 of a staged upload, read in full while it is still the object {@code checked}
     * describes ({@code If-Match}).
     *
     * @throws StagedUploadChangedException when the staged object was replaced or removed
     */
    String sha256Staged(String key, StoredObject checked);

    /**
     * Moves a checked staged upload to {@code key} in the <b>private</b> bucket (verification documents): a
     * server-side copy under the same ETag guard as {@link #publishStaged}, then the staged copy is deleted.
     * Nothing ever reaches the public bucket.
     *
     * @throws StagedUploadChangedException when the staged object was replaced or removed; nothing is copied
     */
    void keepStagedPrivate(String key, StoredObject checked);

    /**
     * A URL that reads one private object for {@code ttl} (an admin viewing a document). The response is a
     * download ({@code Content-Disposition: attachment}) of the given type, whatever the object says.
     */
    PresignedDownload presignPrivateDownload(String key, String contentType, String fileName, Duration ttl);

    /**
     * Stores a file the API produced itself (an AI Studio result, #55, or an image taken out of a catalog PDF,
     * #129) in the <b>private</b> bucket under {@code key}. Never a staged or a public key.
     * It is never public until {@link #publishPrivate} copies it after the seller's approval.
     */
    void putPrivate(String key, byte[] bytes, String contentType);

    /**
     * Copies the private object {@code privateKey} to the public bucket under {@code publicKey} (an approved AI
     * Studio result becomes a product photo, #55). The private object stays; the caller deletes it.
     */
    void publishPrivate(String privateKey, String publicKey);

    /** Removes a private object (not a staged one); nothing happens when it does not exist. */
    void deletePrivate(String key);

    /** A presigned upload: the browser sends {@code method} to {@code url} with {@code headers}. */
    record PresignedUpload(String url, String method, Map<String, String> headers, Instant expiresAt) {
    }

    /** A stored object as a HEAD sees it; {@code etag} is null when the storage sends none. */
    record StoredObject(long sizeBytes, String contentType, String etag) {
    }

    /** A presigned read of a private object. */
    record PresignedDownload(String url, Instant expiresAt) {
    }
}
