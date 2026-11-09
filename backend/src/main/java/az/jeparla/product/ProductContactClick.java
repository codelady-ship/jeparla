package az.jeparla.product;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;
import org.hibernate.annotations.Immutable;

/**
 * WhatsApp contact clicks of one product on one day (Asia/Baku), for the merchant dashboard
 * (PLAN 5.7) and the v1 commission model (PLAN 4). Counted only through
 * {@link ProductContactClickRepository#increment}, never through the entity.
 */
@Entity
@Immutable
@Table(name = "product_contact_clicks")
public class ProductContactClick {

    @EmbeddedId
    private Key id;

    @Column(name = "clicks", nullable = false)
    private long clicks;

    protected ProductContactClick() {
    }

    public Long getProductId() {
        return id.productId;
    }

    public LocalDate getDay() {
        return id.day;
    }

    public long getClicks() {
        return clicks;
    }

    /** Primary key: product and day. */
    @Embeddable
    public record Key(@Column(name = "product_id", nullable = false) Long productId,
            @Column(name = "day", nullable = false) LocalDate day) {
    }
}
