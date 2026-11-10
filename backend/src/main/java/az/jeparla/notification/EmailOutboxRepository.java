package az.jeparla.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailOutboxRepository extends JpaRepository<EmailOutboxMessage, Long> {

    /** Messages due for an attempt, oldest first. */
    @Query("""
            select m from EmailOutboxMessage m
            where m.status = az.jeparla.notification.EmailOutboxMessage.Status.PENDING and m.nextAttemptAt <= :now
            order by m.nextAttemptAt, m.id
            """)
    List<EmailOutboxMessage> findDue(@Param("now") Instant now, Pageable page);

    List<EmailOutboxMessage> findByNotificationId(Long notificationId);
}
