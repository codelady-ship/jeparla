package az.jeparla.ai;

import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** A reference photo of an AI model (#130, V41), uploaded by the admin into the public bucket. */
@Entity
@Table(name = "ai_model_images")
public class AiModelImage extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "model_id", nullable = false, updatable = false)
    private AiModel model;

    @Column(name = "storage_key", nullable = false, unique = true, updatable = false)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "pose", nullable = false)
    private ModelPose pose;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(name = "width", nullable = false, updatable = false)
    private int width;

    @Column(name = "height", nullable = false, updatable = false)
    private int height;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected AiModelImage() {
    }

    AiModelImage(String storageKey, ModelPose pose, String contentType, int width, int height, long sizeBytes,
            int sortOrder) {
        this.storageKey = storageKey;
        this.pose = pose;
        this.contentType = contentType;
        this.width = width;
        this.height = height;
        this.sizeBytes = sizeBytes;
        this.sortOrder = sortOrder;
    }

    void setModel(AiModel model) {
        this.model = model;
    }

    public AiModel getModel() {
        return model;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public ModelPose getPose() {
        return pose;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
