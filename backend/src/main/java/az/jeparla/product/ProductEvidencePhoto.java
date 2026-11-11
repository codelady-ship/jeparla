package az.jeparla.product;

import az.jeparla.auth.User;
import az.jeparla.common.persistence.CreatedEntity;
import az.jeparla.verification.CheckStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * A hallmark or label photo of a product (#106, V21): evidence the seller adds next to the gallery, at most one
 * of each {@link EvidenceKind}. In the public bucket like gallery photos, shown only with the APPROVED product.
 * An admin compares it with the product data: {@link CheckStatus#PENDING} until then, {@link CheckStatus#VERIFIED}
 * or {@link CheckStatus#REJECTED} (with a note) after. It is never a laboratory assay (PLAN 5.9).
 */
@Entity
@Table(name = "product_evidence_photos")
public class ProductEvidencePhoto extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false)
    private EvidenceKind kind;

    @Column(name = "storage_key", nullable = false, unique = true, updatable = false)
    private String storageKey;

    @Column(name = "width", nullable = false, updatable = false)
    private int width;

    @Column(name = "height", nullable = false, updatable = false)
    private int height;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CheckStatus status = CheckStatus.PENDING;

    @Column(name = "check_note")
    private String checkNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_by")
    private User checkedBy;

    @Column(name = "checked_at")
    private Instant checkedAt;

    protected ProductEvidencePhoto() {
    }

    public ProductEvidencePhoto(EvidenceKind kind, String storageKey, int width, int height, String contentType,
            long sizeBytes) {
        this.kind = Objects.requireNonNull(kind);
        this.storageKey = Objects.requireNonNull(storageKey);
        this.width = width;
        this.height = height;
        this.contentType = Objects.requireNonNull(contentType);
        this.sizeBytes = sizeBytes;
    }

    void attachTo(Product product) {
        this.product = product;
    }

    /** Admin decision: VERIFIED, or REJECTED with a note. */
    public void check(CheckStatus decision, String note, User admin, Instant now) {
        if (decision != CheckStatus.VERIFIED && decision != CheckStatus.REJECTED) {
            throw new IllegalArgumentException("An evidence photo is VERIFIED or REJECTED, not " + decision);
        }
        if (decision == CheckStatus.REJECTED && (note == null || note.isBlank())) {
            throw new IllegalArgumentException("A rejected evidence photo needs a note");
        }
        this.status = decision;
        this.checkNote = note == null || note.isBlank() ? null : note.strip();
        this.checkedBy = admin;
        this.checkedAt = Objects.requireNonNull(now);
    }

    public Product getProduct() {
        return product;
    }

    public EvidenceKind getKind() {
        return kind;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public CheckStatus getStatus() {
        return status;
    }

    public String getCheckNote() {
        return checkNote;
    }

    public User getCheckedBy() {
        return checkedBy;
    }

    public Instant getCheckedAt() {
        return checkedAt;
    }
}
