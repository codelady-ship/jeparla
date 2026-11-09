package az.jeparla.product;

import az.jeparla.auth.User;
import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** A product saved by a signed-in buyer (PLAN 5.11). Unique per user and product. */
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
}
