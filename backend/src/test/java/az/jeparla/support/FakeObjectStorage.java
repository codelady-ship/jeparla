package az.jeparla.support;

import az.jeparla.common.storage.ObjectStorage;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * In-memory stand-in for the two S3 buckets: tests "upload" a file with {@link #put}, as the browser would
 * with the presigned URL (into the private staging area), and the API checks and publishes it through the
 * same {@link ObjectStorage} calls as in production. {@link #contains} is what the public bucket serves.
 */
public class FakeObjectStorage implements ObjectStorage {

    private record Stored(byte[] bytes, String contentType) {
    }

    private final Map<String, Stored> staged = new ConcurrentHashMap<>();
    private final Map<String, Stored> published = new ConcurrentHashMap<>();

    /** What the browser does with the presigned URL: the file lands in the private staging area. */
    public void put(String key, byte[] bytes, String contentType) {
        staged.put(key, new Stored(bytes.clone(), contentType));
    }

    /** Whether the public bucket serves {@code key}. */
    public boolean contains(String key) {
        return published.containsKey(key);
    }

    /** Whether {@code key} waits in the private staging area. */
    public boolean isStaged(String key) {
        return staged.containsKey(key);
    }

    @Override
    public PresignedUpload presignStagedUpload(String key, String contentType, long sizeBytes, Duration ttl) {
        return new PresignedUpload("http://storage.test/jeparla-private/" + STAGING_PREFIX + key
                + "?X-Amz-Signature=test", "PUT", Map.of("Content-Type", contentType), Instant.now().plus(ttl));
    }

    @Override
    public Optional<StoredObject> headStaged(String key) {
        Stored stored = staged.get(key);
        return stored == null ? Optional.empty() : Optional.of(new StoredObject(stored.bytes().length, stored.contentType()));
    }

    @Override
    public byte[] readStagedStart(String key, int maxBytes) {
        Stored stored = staged.get(key);
        if (stored == null) {
            throw new IllegalStateException("No staged object " + key);
        }
        return Arrays.copyOf(stored.bytes(), Math.min(maxBytes, stored.bytes().length));
    }

    @Override
    public void publishStaged(String key) {
        Stored stored = staged.remove(key);
        if (stored == null) {
            throw new IllegalStateException("No staged object " + key);
        }
        published.put(key, stored);
    }

    @Override
    public void deleteStaged(String key) {
        staged.remove(key);
    }

    @Override
    public void delete(String key) {
        published.remove(key);
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
