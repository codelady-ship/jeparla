package az.jeparla.ai;

import az.jeparla.common.error.ApiException;
import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * One AI Studio request of a seller (#55, V40). The state machine lives here: every transition checks the
 * current status and answers 409 {@code ai.job_state} when the job cannot make it.
 */
@Entity
@Table(name = "ai_jobs")
public class AiJob extends LongIdEntity {

    @Column(name = "store_id", nullable = false, updatable = false)
    private Long storeId;

    @Column(name = "product_id", nullable = false, updatable = false)
    private Long productId;

    @Column(name = "source_image_id")
    private Long sourceImageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false)
    private AiJobKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AiJobStatus status;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "max_attempts", nullable = false, updatable = false)
    private int maxAttempts;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "model_id", updatable = false)
    private Long modelId;

    @Column(name = "idempotency_key", updatable = false)
    private UUID idempotencyKey;

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AiJob() {
    }

    public AiJob(long storeId, long productId, long sourceImageId, AiJobKind kind, int maxAttempts,
            UUID idempotencyKey, Long createdBy, Instant now) {
        this.storeId = storeId;
        this.productId = productId;
        this.sourceImageId = sourceImageId;
        this.kind = kind;
        this.status = AiJobStatus.QUEUED;
        this.maxAttempts = maxAttempts;
        this.idempotencyKey = idempotencyKey;
        this.createdBy = createdBy;
        this.createdAt = now;
        this.updatedAt = now;
    }

    private static ApiException state() {
        return new ApiException(HttpStatus.CONFLICT, "ai.job_state");
    }

    private void require(AiJobStatus... allowed) {
        for (AiJobStatus s : allowed) {
            if (status == s) {
                return;
            }
        }
        throw state();
    }

    /** The worker takes the job: QUEUED -> PROCESSING, one more attempt. */
    public void start(Instant now) {
        require(AiJobStatus.QUEUED);
        if (attempts >= maxAttempts) {
            throw state();
        }
        attempts++;
        status = AiJobStatus.PROCESSING;
        errorCode = null;
        updatedAt = now;
    }

    /** The provider returned images: PROCESSING -> REVIEW_REQUIRED. */
    public void resultReady(Instant now) {
        require(AiJobStatus.PROCESSING);
        status = AiJobStatus.REVIEW_REQUIRED;
        updatedAt = now;
    }

    /** QUEUED or PROCESSING -> FAILED with a stable code (never provider text). */
    public void fail(String code, Instant now) {
        require(AiJobStatus.QUEUED, AiJobStatus.PROCESSING);
        status = AiJobStatus.FAILED;
        errorCode = code;
        updatedAt = now;
    }

    /** FAILED -> QUEUED while attempts are left; 409 {@code ai.no_attempts_left} otherwise. */
    public void retry(Instant now) {
        require(AiJobStatus.FAILED);
        if (!canRetry()) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.no_attempts_left");
        }
        status = AiJobStatus.QUEUED;
        updatedAt = now;
    }

    public boolean canRetry() {
        return status == AiJobStatus.FAILED && attempts < maxAttempts
                && !ImageGenerationCodes.NOT_RETRYABLE.contains(errorCode);
    }

    /** The seller chose a result: REVIEW_REQUIRED -> APPROVED. */
    public void approve(Instant now) {
        require(AiJobStatus.REVIEW_REQUIRED);
        status = AiJobStatus.APPROVED;
        updatedAt = now;
    }

    /** Rejected result or deleted job: QUEUED, REVIEW_REQUIRED or FAILED -> CANCELLED. PROCESSING waits. */
    public void cancel(Instant now) {
        require(AiJobStatus.QUEUED, AiJobStatus.REVIEW_REQUIRED, AiJobStatus.FAILED);
        status = AiJobStatus.CANCELLED;
        updatedAt = now;
    }

    /** The AI model of a VIRTUAL_TRY_ON job (#130), set once before the job is saved. */
    public void useModel(Long modelId) {
        if (getId() != null) {
            throw new IllegalStateException("The model is chosen when the job is created");
        }
        this.modelId = modelId;
    }

    public Long getModelId() {
        return modelId;
    }

    public long getStoreId() {
        return storeId;
    }

    public long getProductId() {
        return productId;
    }

    public Long getSourceImageId() {
        return sourceImageId;
    }

    public AiJobKind getKind() {
        return kind;
    }

    public AiJobStatus getStatus() {
        return status;
    }

    public int getAttempts() {
        return attempts;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public UUID getIdempotencyKey() {
        return idempotencyKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
