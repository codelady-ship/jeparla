package az.jeparla.common.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Entity with {@code created_at} and {@code updated_at TIMESTAMPTZ}. The schema has no trigger
 * for {@code updated_at}: Hibernate sets it on every insert and update (#32).
 */
@MappedSuperclass
public abstract class TimestampedEntity extends CreatedEntity {

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
