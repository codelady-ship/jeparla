package az.jeparla.merchant;

import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * A photo waiting to become a product (#129, #109, V23): from the phone camera, from many photos picked at
 * once, or taken out of a catalog PDF with the suggestions of its page. The image is in the private bucket.
 */
@Entity
@Table(name = "product_drafts")
public class ProductDraft extends LongIdEntity {

    public enum Source {
        PHOTO,
        CAMERA,
        PDF
    }

    @Column(name = "store_id", nullable = false, updatable = false)
    private Long storeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, updatable = false)
    private Source source;

    @Column(name = "image_key", nullable = false, updatable = false)
    private String imageKey;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(name = "width", nullable = false, updatable = false)
    private int width;

    @Column(name = "height", nullable = false, updatable = false)
    private int height;

    @Column(name = "pdf_page", updatable = false)
    private Integer pdfPage;

    @Column(name = "suggested_name", updatable = false)
    private String suggestedName;

    @Column(name = "suggested_price", updatable = false)
    private BigDecimal suggestedPrice;

    @Column(name = "suggested_weight", updatable = false)
    private BigDecimal suggestedWeight;

    /** The cleaned text of the PDF page (V67): the form reads category, metal, fineness and description from it. */
    @Column(name = "page_text", updatable = false)
    private String pageText;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ProductDraft() {
    }

    ProductDraft(Long storeId, Source source, String imageKey, String contentType, int width, int height,
            Integer pdfPage, DraftSuggestions suggestions, Instant createdAt) {
        this.storeId = storeId;
        this.source = source;
        this.imageKey = imageKey;
        this.contentType = contentType;
        this.width = width;
        this.height = height;
        this.pdfPage = pdfPage;
        if (suggestions != null) {
            this.suggestedName = suggestions.name();
            this.suggestedPrice = suggestions.price();
            this.suggestedWeight = suggestions.weight();
            this.pageText = suggestions.text();
        }
        this.createdAt = createdAt;
    }

    public Long getStoreId() {
        return storeId;
    }

    public Source getSource() {
        return source;
    }

    public String getImageKey() {
        return imageKey;
    }

    public String getContentType() {
        return contentType;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public Integer getPdfPage() {
        return pdfPage;
    }

    public String getSuggestedName() {
        return suggestedName;
    }

    public BigDecimal getSuggestedPrice() {
        return suggestedPrice;
    }

    public BigDecimal getSuggestedWeight() {
        return suggestedWeight;
    }

    public String getPageText() {
        return pageText;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
