package az.jeparla.verification;

import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One presigned document upload the API handed out (#40, V15): what the seller said the file is, and where it
 * goes once checked. Open while it is neither attached nor discarded.
 */
@Entity
@Table(name = "document_upload_slots")
class DocumentUploadSlot extends LongIdEntity {

    @Column(name = "storage_key", nullable = false, unique = true, updatable = false)
    private String storageKey;

    @Column(name = "store_id", nullable = false, updatable = false)
    private Long storeId;

    @Column(name = "product_id", updatable = false)
    private Long productId;

    @Enumerated(EnumType.STRING)
    @Column(name = "check_kind", nullable = false, updatable = false)
    private CheckKind checkKind;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false)
    private DocumentKind kind;

    @Column(name = "file_name", nullable = false, updatable = false)
    private String fileName;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "attached_at")
    private Instant attachedAt;

    @Column(name = "discarded_at")
    private Instant discardedAt;

    protected DocumentUploadSlot() {
    }

    DocumentUploadSlot(String storageKey, long storeId, Long productId, CheckKind checkKind, DocumentKind kind,
            String fileName, String contentType, long sizeBytes, Instant createdAt, Instant expiresAt) {
        this.storageKey = storageKey;
        this.storeId = storeId;
        this.productId = productId;
        this.checkKind = checkKind;
        this.kind = kind;
        this.fileName = fileName;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    String getStorageKey() {
        return storageKey;
    }

    long getStoreId() {
        return storeId;
    }

    Long getProductId() {
        return productId;
    }

    CheckKind getCheckKind() {
        return checkKind;
    }

    DocumentKind getKind() {
        return kind;
    }

    String getFileName() {
        return fileName;
    }

    String getContentType() {
        return contentType;
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

    void discarded(Instant now) {
        this.discardedAt = now;
    }
}
