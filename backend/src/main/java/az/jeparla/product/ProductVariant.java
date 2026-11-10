package az.jeparla.product;

import static az.jeparla.common.persistence.Decimals.money;
import static az.jeparla.common.persistence.Decimals.percent;
import static az.jeparla.common.persistence.Decimals.weight;

import az.jeparla.common.Currencies;
import az.jeparla.common.persistence.Decimals;
import az.jeparla.common.persistence.TimestampedEntity;
import az.jeparla.pricing.MetalPriceSnapshot;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Currency;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Sellable variant of a product: fineness, weight, size and price (PLAN 5.2, 5.10). Money is
 * {@code NUMERIC(12,2)} + currency, weight {@code NUMERIC(8,3)}; setters bring values to that
 * scale ({@link Decimals}).
 *
 * <p>{@code store_id} copies the product's store (composite foreign key) so the SKU can be
 * unique per store; it is filled on insert. Removed variants keep their row
 * ({@code deleted_at}) for the price history.
 */
@Entity
@Table(name = "product_variants")
public class ProductVariant extends TimestampedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @Column(name = "store_id", nullable = false, updatable = false)
    private Long storeId;

    @Column(name = "sku", nullable = false)
    private String sku;

    /** The fineness of a PRECIOUS product's variant; null for FASHION (#128, CHECK {@code product_variants_by_kind}). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fineness_id")
    private Fineness fineness;

    /** Copy of the product's kind, written by the trigger {@code product_variants_material_kind} (V13). */
    @Enumerated(EnumType.STRING)
    @Column(name = "material_kind", insertable = false, updatable = false)
    private MaterialKind materialKind;

    /**
     * Copy of the fineness metal, written by the database trigger {@code product_variants_metal} (V10)
     * and read-only here. Composite foreign keys keep it equal to the fineness and the product metal.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "metal", insertable = false, updatable = false)
    private Metal metal;

    /** Required for PRECIOUS variants, optional for FASHION ones. */
    @Column(name = "weight_grams", precision = 8, scale = 3)
    private BigDecimal weightGrams;

    @Column(name = "size")
    private String size;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3)
    private Currency currency = Currencies.AZN;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_mode", nullable = false)
    private PricingMode pricingMode = PricingMode.FIXED;

    @Column(name = "labor_per_gram", nullable = false, precision = 12, scale = 2)
    private BigDecimal laborPerGram = Decimals.ZERO_MONEY;

    @Column(name = "labor_fixed", nullable = false, precision = 12, scale = 2)
    private BigDecimal laborFixed = Decimals.ZERO_MONEY;

    @Column(name = "stone_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal stonePrice = Decimals.ZERO_MONEY;

    @Column(name = "markup_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal markupPercent = Decimals.ZERO_MONEY;

    @Column(name = "min_price", precision = 12, scale = 2)
    private BigDecimal minPrice;

    @Column(name = "max_price", precision = 12, scale = 2)
    private BigDecimal maxPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "stock_status", nullable = false)
    private StockStatus stockStatus = StockStatus.IN_STOCK;

    /** "Price last updated" on the product page. */
    @Column(name = "price_updated_at", nullable = false)
    private Instant priceUpdatedAt;

    /** The quote the current METAL_LINKED price was computed from. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "metal_snapshot_id")
    private MetalPriceSnapshot metalSnapshot;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected ProductVariant() {
    }

    public ProductVariant(String sku, Fineness fineness, BigDecimal weightGrams, BigDecimal price,
            Currency currency, Instant priceUpdatedAt) {
        this.sku = sku;
        this.fineness = fineness;
        this.weightGrams = weight(weightGrams);
        this.price = money(price);
        this.currency = Objects.requireNonNull(currency);
        this.priceUpdatedAt = Objects.requireNonNull(priceUpdatedAt);
    }

    void attachTo(Product product) {
        this.product = product;
    }

    @PrePersist
    void copyStoreOfProduct() {
        if (storeId == null && product != null) {
            storeId = product.getStore().getId();
        }
    }

    void markDeleted(Instant now) {
        if (deletedAt == null) {
            deletedAt = now;
        }
    }

    /** FIXED price typed by the seller. Clears the METAL_LINKED inputs (zero, as the schema says). */
    public void setFixedPrice(BigDecimal price, Instant now) {
        this.pricingMode = PricingMode.FIXED;
        this.laborPerGram = Decimals.ZERO_MONEY;
        this.laborFixed = Decimals.ZERO_MONEY;
        this.stonePrice = Decimals.ZERO_MONEY;
        this.markupPercent = Decimals.ZERO_MONEY;
        this.minPrice = null;
        this.maxPrice = null;
        this.metalSnapshot = null;
        this.price = money(price);
        this.priceUpdatedAt = now;
    }

    /** METAL_LINKED inputs (PLAN 5.10). The price itself is set by the pricing engine (#44). */
    public void setMetalLinkedRule(BigDecimal laborPerGram, BigDecimal laborFixed, BigDecimal stonePrice,
            BigDecimal markupPercent, BigDecimal minPrice, BigDecimal maxPrice) {
        if (product != null) {
            product.requireFitting(fineness, PricingMode.METAL_LINKED);
        }
        this.pricingMode = PricingMode.METAL_LINKED;
        this.laborPerGram = money(laborPerGram);
        this.laborFixed = money(laborFixed);
        this.stonePrice = money(stonePrice);
        this.markupPercent = percent(markupPercent);
        this.minPrice = money(minPrice);
        this.maxPrice = money(maxPrice);
    }

    /** A METAL_LINKED price computed from {@code snapshot}. */
    public void applyMetalPrice(BigDecimal price, MetalPriceSnapshot snapshot, Instant now) {
        this.price = money(price);
        this.metalSnapshot = snapshot;
        this.priceUpdatedAt = now;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public Product getProduct() {
        return product;
    }

    public Long getStoreId() {
        return storeId;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public Fineness getFineness() {
        return fineness;
    }

    /** A fineness of the product's metal, or none for FASHION; the database rejects any other (V10, V13). */
    public void setFineness(Fineness fineness) {
        if (product != null) {
            product.requireFitting(fineness, pricingMode);
        }
        this.fineness = fineness;
    }

    /** The product's kind as the database stored it; null on a new variant until it is flushed and loaded again. */
    public MaterialKind getMaterialKind() {
        return materialKind;
    }

    /**
     * The metal the database stored for this variant (always its fineness metal). Read-only: it is
     * null on a new variant until it is flushed and loaded again.
     */
    public Metal getMetal() {
        return metal;
    }

    public BigDecimal getWeightGrams() {
        return weightGrams;
    }

    public void setWeightGrams(BigDecimal weightGrams) {
        this.weightGrams = weight(weightGrams);
    }

    public String getSize() {
        return size;
    }

    public void setSize(String size) {
        this.size = size;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public Currency getCurrency() {
        return currency;
    }

    public PricingMode getPricingMode() {
        return pricingMode;
    }

    public BigDecimal getLaborPerGram() {
        return laborPerGram;
    }

    public BigDecimal getLaborFixed() {
        return laborFixed;
    }

    public BigDecimal getStonePrice() {
        return stonePrice;
    }

    public BigDecimal getMarkupPercent() {
        return markupPercent;
    }

    public BigDecimal getMinPrice() {
        return minPrice;
    }

    public BigDecimal getMaxPrice() {
        return maxPrice;
    }

    public StockStatus getStockStatus() {
        return stockStatus;
    }

    public void setStockStatus(StockStatus stockStatus) {
        this.stockStatus = stockStatus;
    }

    public Instant getPriceUpdatedAt() {
        return priceUpdatedAt;
    }

    public MetalPriceSnapshot getMetalSnapshot() {
        return metalSnapshot;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
