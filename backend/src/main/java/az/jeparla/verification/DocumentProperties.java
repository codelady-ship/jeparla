package az.jeparla.verification;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Document upload limits and the admin's view link (#40), bound from {@code jeparla.verification.documents.*}.
 * The per-account presign limit is the rate-limit policy {@code document-upload-account}.
 *
 * @param openUploadsPerStore  presigned uploads of a store that are neither attached nor expired at one time
 * @param dailyUploadsPerStore presigned uploads one store gets in 24 hours, attached or not
 * @param viewUrlTtl           life of the presigned URL an admin opens a document with
 * @param cleanupLockAtMostFor longest a cleanup run may hold its ShedLock lock
 */
@ConfigurationProperties("jeparla.verification.documents")
public record DocumentProperties(
        @DefaultValue("10") int openUploadsPerStore,
        @DefaultValue("50") int dailyUploadsPerStore,
        @DefaultValue("5m") Duration viewUrlTtl,
        @DefaultValue("15m") Duration cleanupLockAtMostFor) {

    public DocumentProperties {
        if (openUploadsPerStore < 1 || dailyUploadsPerStore < openUploadsPerStore) {
            throw new IllegalArgumentException("jeparla.verification.documents: open-uploads-per-store must be at least"
                    + " 1 and daily-uploads-per-store at least open-uploads-per-store");
        }
        if (viewUrlTtl.isNegative() || viewUrlTtl.isZero() || viewUrlTtl.compareTo(Duration.ofMinutes(15)) > 0) {
            throw new IllegalArgumentException(
                    "jeparla.verification.documents.view-url-ttl must be between 1 second and 15 minutes");
        }
    }
}
