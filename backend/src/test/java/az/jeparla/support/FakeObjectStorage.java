package az.jeparla.support;

import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.StagedUploadChangedException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * In-memory stand-in for the two S3 buckets: tests "upload" a file with {@link #put}, as the browser would
 * with the presigned URL (into the private staging area), and the API checks and publishes it through the
 * same {@link ObjectStorage} calls as in production. {@link #contains} is what the public bucket serves.
 *
 * <p>Like S3, every object has an ETag (the MD5 of its bytes, quoted) and the read and the copy are
 * conditional on the ETag the API checked (#158). {@link #beforeNextPublish} and {@link #failNextPublishAfterCopy}
 * simulate a PUT between the check and the copy and a copy that succeeds on the server but fails in the client.
 */
public class FakeObjectStorage implements ObjectStorage {

    private record Stored(byte[] bytes, String contentType, String etag) {
    }

    private final Map<String, Stored> staged = new ConcurrentHashMap<>();
    private final Map<String, Stored> published = new ConcurrentHashMap<>();
    private final Map<String, Stored> privateObjects = new ConcurrentHashMap<>();
    private final AtomicReference<Runnable> beforeNextPublish = new AtomicReference<>();
    private final AtomicReference<RuntimeException> failNextPublishAfterCopy = new AtomicReference<>();

    /** What the browser does with the presigned URL: the file lands in the private staging area. */
    public void put(String key, byte[] bytes, String contentType) {
        staged.put(key, new Stored(bytes.clone(), contentType, etag(bytes)));
    }

    /** Whether the public bucket serves {@code key}. */
    public boolean contains(String key) {
        return published.containsKey(key);
    }

    /** Whether {@code key} waits in the private staging area. */
    public boolean isStaged(String key) {
        return staged.containsKey(key);
    }

    /** Runs {@code action} once, at the start of the next {@link #publishStaged}, before its condition. */
    public void beforeNextPublish(Runnable action) {
        beforeNextPublish.set(action);
    }

    /** The next {@link #publishStaged} copies the file and then throws {@code failure}, keeping the staged copy. */
    public void failNextPublishAfterCopy(RuntimeException failure) {
        failNextPublishAfterCopy.set(failure);
    }

    @Override
    public PresignedUpload presignStagedUpload(String key, String contentType, long sizeBytes, Duration ttl) {
        return new PresignedUpload("http://storage.test/jeparla-private/" + STAGING_PREFIX + key
                + "?X-Amz-Signature=test", "PUT", Map.of("Content-Type", contentType), Instant.now().plus(ttl));
    }

    @Override
    public Optional<StoredObject> headStaged(String key) {
        Stored stored = staged.get(key);
        return stored == null ? Optional.empty()
                : Optional.of(new StoredObject(stored.bytes().length, stored.contentType(), stored.etag()));
    }

    @Override
    public byte[] readStagedStart(String key, StoredObject checked, int maxBytes) {
        Stored stored = matching(key, checked);
        return Arrays.copyOf(stored.bytes(), Math.min(maxBytes, stored.bytes().length));
    }

    @Override
    public void publishStaged(String key, StoredObject checked) {
        Runnable before = beforeNextPublish.getAndSet(null);
        if (before != null) {
            before.run();
        }
        Stored stored = matching(key, checked);
        published.put(key, stored);
        RuntimeException failure = failNextPublishAfterCopy.getAndSet(null);
        if (failure != null) {
            throw failure;
        }
        staged.remove(key);
    }

    @Override
    public void deleteStaged(String key) {
        staged.remove(key);
    }

    @Override
    public void delete(String key) {
        published.remove(key);
    }

    @Override
    public String sha256Staged(String key, StoredObject checked) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(matching(key, checked).bytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public void keepStagedPrivate(String key, StoredObject checked) {
        Runnable before = beforeNextPublish.getAndSet(null);
        if (before != null) {
            before.run();
        }
        privateObjects.put(key, matching(key, checked));
        staged.remove(key);
    }

    @Override
    public PresignedDownload presignPrivateDownload(String key, String contentType, String fileName, Duration ttl) {
        return new PresignedDownload("http://storage.test/jeparla-private/" + key + "?X-Amz-Expires=" + ttl.toSeconds()
                + "&X-Amz-Signature=test", Instant.now().plus(ttl));
    }

    @Override
    public void deletePrivate(String key) {
        privateObjects.remove(key);
    }

    @Override
    public void putPrivate(String key, byte[] bytes, String contentType) {
        privateObjects.put(key, new Stored(bytes.clone(), contentType, etag(bytes)));
    }

    @Override
    public void publishPrivate(String privateKey, String publicKey) {
        Stored stored = privateObjects.get(privateKey);
        if (stored == null) {
            throw new IllegalStateException("No private object " + privateKey);
        }
        published.put(publicKey, stored);
    }

    /** Whether {@code key} is a checked document in the private bucket (never served publicly). */
    public boolean isPrivate(String key) {
        return privateObjects.containsKey(key);
    }

    /** The staged object if its ETag is still the checked one (If-Match), else 412 as the exception. */
    private Stored matching(String key, StoredObject checked) {
        Stored stored = staged.get(key);
        if (stored == null || !stored.etag().equals(checked.etag())) {
            throw new StagedUploadChangedException(key);
        }
        return stored;
    }

    private static String etag(byte[] bytes) {
        try {
            return "\"" + HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(bytes)) + "\"";
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Replaces the storage bean of the test context. */
    @TestConfiguration(proxyBeanMethods = false)
    public static class Config {

        @Bean
        @Primary
        FakeObjectStorage fakeObjectStorage() {
            return new FakeObjectStorage();
        }
    }
}
