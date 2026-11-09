package az.jeparla.common.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

/** Entity with a {@code created_at TIMESTAMPTZ} column set once, on insert. */
@MappedSuperclass
public abstract class CreatedEntity extends LongIdEntity {

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Instant getCreatedAt() {
        return createdAt;
    }
}
