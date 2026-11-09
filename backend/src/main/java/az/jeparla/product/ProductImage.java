package az.jeparla.product;

import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Product photo in the public bucket. Only the object key is stored; the URL is built from
 * {@code JEPARLA_S3_PUBLIC_URL}. AI-generated or AI-edited images carry a visible label
 * (CLAUDE.md, honesty).
 */
@Entity
@Table(name = "product_images")
public class ProductImage extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @Column(name = "storage_key", nullable = false, unique = true)
    private String storageKey;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "az", column = @Column(name = "alt_az")),
            @AttributeOverride(name = "en", column = @Column(name = "alt_en")),
            @AttributeOverride(name = "ru", column = @Column(name = "alt_ru"))
    })
    private LocalizedText alt;

    @Column(name = "width", nullable = false)
    private int width;

    @Column(name = "height", nullable = false)
    private int height;

    /** image/jpeg, image/png, image/webp or image/avif (CHECK). */
    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "ai_generated", nullable = false)
    private boolean aiGenerated;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProductImage() {
    }

    public ProductImage(String storageKey, int width, int height, String contentType, long sizeBytes,
            boolean aiGenerated, int sortOrder) {
        this.storageKey = storageKey;
        this.width = width;
        this.height = height;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.aiGenerated = aiGenerated;
        this.sortOrder = sortOrder;
    }

    void attachTo(Product product) {
        this.product = product;
    }

    public Product getProduct() {
        return product;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public LocalizedText getAlt() {
        return alt;
    }

    public void setAlt(LocalizedText alt) {
        this.alt = alt;
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

    public boolean isAiGenerated() {
        return aiGenerated;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
