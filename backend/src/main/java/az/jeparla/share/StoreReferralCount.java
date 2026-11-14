package az.jeparla.share;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import org.hibernate.annotations.Immutable;

/**
 * Referral counters of one store, day (Asia/Baku) and source (#100, V20). Read-only mapping, so Hibernate validates
 * the table against the schema; counted only through {@link ReferralCounts}, never through the entity.
 */
@Entity
@Immutable
@Table(name = "store_referral_counts")
public class StoreReferralCount {

    @EmbeddedId
    private Key id;

    @Column(name = "visits", nullable = false)
    private long visits;

    @Column(name = "whatsapp_clicks", nullable = false)
    private long whatsappClicks;

    protected StoreReferralCount() {
    }

    public Key getId() {
        return id;
    }

    public long getVisits() {
        return visits;
    }

    public long getWhatsappClicks() {
        return whatsappClicks;
    }

    /** Primary key: store, day and source. */
    @Embeddable
    public record Key(@Column(name = "store_id", nullable = false) Long storeId,
            @Column(name = "day", nullable = false) LocalDate day,
            @Enumerated(EnumType.STRING) @Column(name = "source", nullable = false) ReferralSource source) {
    }
}
