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
 * In-memory stand-in for the S3 bucket: tests "upload" a file with {@link #put}, as the browser would with
 * the presigned URL, and the API checks it through the same {@link ObjectStorage} calls as in production.
 */
public class FakeObjectStorage implements ObjectStorage {

    private record Stored(byte[] bytes, String contentType) {
    }

    private final Map<String, Stored> objects = new ConcurrentHashMap<>();

    /** What the browser does with the presigned URL. */
    public void put(String key, byte[] bytes, String contentType) {
        objects.put(key, new Stored(bytes.clone(), contentType));
    }

    public boolean contains(String key) {
        return objects.containsKey(key);
    }

    @Override
    public PresignedUpload presignUpload(String key, String contentType, long sizeBytes, Duration ttl) {
        return new PresignedUpload("http://storage.test/jeparla-public/" + key + "?X-Amz-Signature=test", "PUT",
                Map.of("Content-Type", contentType), Instant.now().plus(ttl));
    }

    @Override
    public Optional<StoredObject> head(String key) {
        Stored stored = objects.get(key);
        return stored == null ? Optional.empty() : Optional.of(new StoredObject(stored.bytes().length, stored.contentType()));
    }

    @Override
    public byte[] readStart(String key, int maxBytes) {
        Stored stored = objects.get(key);
        if (stored == null) {
            throw new IllegalStateException("No object " + key);
        }
        return Arrays.copyOf(stored.bytes(), Math.min(maxBytes, stored.bytes().length));
    }

    @Override
    public void delete(String key) {
        objects.remove(key);
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
