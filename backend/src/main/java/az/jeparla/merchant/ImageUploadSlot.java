package az.jeparla.merchant;

import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One presigned photo upload the API handed out (#154, V14). Open while it is neither attached nor
 * discarded; it counts toward the photo limit of its product until it expires, and toward the daily limit
 * of its store for 24 hours.
 */
@Entity
@Table(name = "image_upload_slots")
class ImageUploadSlot extends LongIdEntity {

    @Column(name = "storage_key", nullable = false, unique = true, updatable = false)
    private String storageKey;

    @Column(name = "product_id", nullable = false, updatable = false)
    private Long productId;

    @Column(name = "store_id", nullable = false, updatable = false)
    private Long storeId;

    /** Gallery photo or evidence photo kind (V21); the attach checks it. */
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false)
    private ImageUploadKind kind = ImageUploadKind.GALLERY;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "attached_at")
    private Instant attachedAt;

    @Column(name = "discarded_at")
    private Instant discardedAt;

    protected ImageUploadSlot() {
    }

    ImageUploadSlot(String storageKey, long productId, long storeId, Instant createdAt, Instant expiresAt) {
        this.storageKey = storageKey;
        this.productId = productId;
        this.storeId = storeId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    ImageUploadSlot(String storageKey, long productId, long storeId, ImageUploadKind kind, Instant createdAt,
            Instant expiresAt) {
        this(storageKey, productId, storeId, createdAt, expiresAt);
        this.kind = kind;
    }

    ImageUploadKind getKind() {
        return kind;
    }

    String getStorageKey() {
        return storageKey;
    }

    long getProductId() {
        return productId;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }

    boolean isOpen() {
        return attachedAt == null && discardedAt == null;
    }

    void attached(Instant now) {
        this.attachedAt = now;
    }
}
