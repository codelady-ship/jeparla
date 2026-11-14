package az.jeparla.ai;

import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** A generated file in the private bucket (#55, V40); public only as a product photo after approval. */
@Entity
@Table(name = "ai_assets")
public class AiAsset extends CreatedEntity {

    @Column(name = "job_id", nullable = false, updatable = false)
    private Long jobId;

    @Column(name = "storage_key", unique = true)
    private String storageKey;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(name = "width", nullable = false, updatable = false)
    private int width;

    @Column(name = "height", nullable = false, updatable = false)
    private int height;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "product_image_id")
    private Long productImageId;

    /** Made by a generative provider (#119, V44): the product photo it becomes carries the AI label. */
    @Column(name = "ai_generated", nullable = false, updatable = false)
    private boolean aiGenerated = true;

    protected AiAsset() {
    }

    AiAsset(long jobId, String storageKey, String contentType, int width, int height, long sizeBytes,
            boolean aiGenerated) {
        this.aiGenerated = aiGenerated;
        this.jobId = jobId;
        this.storageKey = storageKey;
        this.contentType = contentType;
        this.width = width;
        this.height = height;
        this.sizeBytes = sizeBytes;
    }

    long getJobId() {
        return jobId;
    }

    /** Null once the file was deleted (rejected or cancelled job). */
    String getStorageKey() {
        return storageKey;
    }

    String getContentType() {
        return contentType;
    }

    int getWidth() {
        return width;
    }

    int getHeight() {
        return height;
    }

    long getSizeBytes() {
        return sizeBytes;
    }

    boolean isAiGenerated() {
        return aiGenerated;
    }

    Long getProductImageId() {
        return productImageId;
    }

    void becameProductImage(long imageId) {
        this.productImageId = imageId;
    }

    void fileDeleted() {
        this.storageKey = null;
    }
}
