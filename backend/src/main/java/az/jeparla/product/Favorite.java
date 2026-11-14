package az.jeparla.product;

import az.jeparla.auth.User;
import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.Currency;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A product saved by a signed-in buyer (PLAN 5.11). Unique per user and product. Keeps the price of the cheapest
 * live variant at the time it was saved (V17, #112); null for rows saved before that was recorded.
 */
@Entity
@Table(name = "favorites",
        uniqueConstraints = @UniqueConstraint(name = "favorites_user_product_key", columnNames = {"user_id", "product_id"}))
public class Favorite extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @Column(name = "saved_price", precision = 12, scale = 2, updatable = false)
    private BigDecimal savedPrice;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "saved_currency", length = 3, updatable = false)
    private Currency savedCurrency;

    protected Favorite() {
    }

    public Favorite(User user, Product product) {
        this.user = user;
        this.product = product;
    }

    public User getUser() {
        return user;
    }

    public Product getProduct() {
        return product;
    }

    /** Price when saved, or null when it was not recorded. */
    public BigDecimal getSavedPrice() {
        return savedPrice;
    }

    public Currency getSavedCurrency() {
        return savedCurrency;
    }
}
