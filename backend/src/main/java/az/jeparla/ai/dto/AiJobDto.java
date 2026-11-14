package az.jeparla.ai.dto;

import az.jeparla.ai.AiJobKind;
import az.jeparla.ai.AiJobStatus;
import java.time.Instant;
import java.util.List;

/**
 * An AI Studio job and its results.
 *
 * @param errorCode stable code of the last failure (localized in the UI), else null
 * @param canRetry  FAILED with attempts left and a failure a retry can help with
 */
public record AiJobDto(long id, long productId, Long sourceImageId, AiJobKind kind, AiJobStatus status,
        int attempts, int maxAttempts, String errorCode, boolean canRetry, Instant createdAt, Instant updatedAt,
        List<AiAssetDto> assets) {
}
