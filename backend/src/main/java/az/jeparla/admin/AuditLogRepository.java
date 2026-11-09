package az.jeparla.admin;

import az.jeparla.common.persistence.NoDeleteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Append-only audit log. Old rows are removed by a retention job with SQL, not through this API. */
public interface AuditLogRepository extends NoDeleteRepository<AuditLog, Long> {

    /** Admin audit page, newest first. */
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<AuditLog> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(AuditTargetType targetType, String targetId,
            Pageable pageable);

    Page<AuditLog> findByActorIdOrderByCreatedAtDesc(Long actorId, Pageable pageable);
}
