package az.jeparla.common.storage;

import az.jeparla.common.error.ApiException;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;

/**
 * The {@link ObjectStorage} bean: S3 when {@code jeparla.storage.s3} is configured, otherwise a stand-in
 * whose every call answers 503 {@code storage.unavailable} (the catalog, auth and merchant API without
 * images keep working, e.g. in tests and on a machine without MinIO).
 */
@Configuration(proxyBeanMethods = false)
public class StorageConfig {

    private static final Logger log = LoggerFactory.getLogger(StorageConfig.class);

    @Bean
    ObjectStorage objectStorage(S3Properties properties) {
        if (properties.configured()) {
            return new S3ObjectStorage(properties);
        }
        log.warn("Object storage is not configured (JEPARLA_S3_*): image uploads answer 503");
        return new Unavailable();
    }

    /** Storage that is not configured. */
    static final class Unavailable implements ObjectStorage {

        private static ApiException unavailable() {
            return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "storage.unavailable");
        }

        @Override
        public PresignedUpload presignStagedUpload(String key, String contentType, long sizeBytes, Duration ttl) {
            throw unavailable();
        }

        @Override
        public Optional<StoredObject> headStaged(String key) {
            throw unavailable();
        }

        @Override
        public byte[] readStagedStart(String key, StoredObject checked, int maxBytes) {
            throw unavailable();
        }

        @Override
        public void publishStaged(String key, StoredObject checked) {
            throw unavailable();
        }

        @Override
        public void deleteStaged(String key) {
            throw unavailable();
        }

        @Override
        public void delete(String key) {
            throw unavailable();
        }

        @Override
        public String sha256Staged(String key, StoredObject checked) {
            throw unavailable();
        }

        @Override
        public void keepStagedPrivate(String key, StoredObject checked) {
            throw unavailable();
        }

        @Override
        public PresignedDownload presignPrivateDownload(String key, String contentType, String fileName,
                Duration ttl) {
            throw unavailable();
        }

        @Override
        public void deletePrivate(String key) {
            throw unavailable();
        }

        @Override
        public void putPrivate(String key, byte[] bytes, String contentType) {
            throw unavailable();
        }

        @Override
        public void publishPrivate(String privateKey, String publicKey) {
            throw unavailable();
        }
    }
}
