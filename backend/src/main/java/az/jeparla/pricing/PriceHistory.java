package az.jeparla.pricing;

import static az.jeparla.common.persistence.Decimals.money;

import az.jeparla.auth.User;
import az.jeparla.common.persistence.CreatedEntity;
import az.jeparla.product.ProductVariant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.Currency;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One price a variant had, with the reason (PLAN 5.10). Append-only: rows are never updated or
 * deleted (a wrong price is an S1 bug and must stay traceable).
 */
@Entity
@Immutable
@Table(name = "price_history")
public class PriceHistory extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariant variant;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "previous_price", precision = 12, scale = 2)
    private BigDecimal previousPrice;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3)
    private Currency currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false)
    private PriceChangeReason reason;

    /** Required for METAL_PRICE rows (CHECK). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "metal_snapshot_id")
    private MetalPriceSnapshot metalSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private User changedBy;

    protected PriceHistory() {
    }

    public PriceHistory(ProductVariant variant, BigDecimal price, BigDecimal previousPrice, Currency currency,
            PriceChangeReason reason, MetalPriceSnapshot metalSnapshot, User changedBy) {
        this.variant = variant;
        this.price = money(price);
        this.previousPrice = money(previousPrice);
        this.currency = currency;
        this.reason = reason;
        this.metalSnapshot = metalSnapshot;
        this.changedBy = changedBy;
    }

    public ProductVariant getVariant() {
        return variant;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public BigDecimal getPreviousPrice() {
        return previousPrice;
    }

    public Currency getCurrency() {
        return currency;
    }

    public PriceChangeReason getReason() {
        return reason;
    }

    public MetalPriceSnapshot getMetalSnapshot() {
        return metalSnapshot;
    }

    public User getChangedBy() {
        return changedBy;
    }
}
