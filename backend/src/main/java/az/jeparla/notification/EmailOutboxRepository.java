package az.jeparla.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * One-time link emails (#131) still waiting when their link expired: given up (FAILED). Covers the time
     * without an email provider, when nothing is sent. Run before {@link #redactExpired}.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailOutboxMessage m
            set m.status = az.jeparla.notification.EmailOutboxMessage.Status.FAILED,
                m.lastError = 'link expired before sending'
            where m.expiresAt is not null and m.expiresAt <= :now
              and m.status = az.jeparla.notification.EmailOutboxMessage.Status.PENDING
            """)
    int giveUpExpired(@Param("now") Instant now);

    /** Removes the link from every one-time link email (#131) whose link has expired. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailOutboxMessage m set m.body = :redacted
            where m.expiresAt is not null and m.expiresAt <= :now and m.body <> :redacted
            """)
    int redactExpired(@Param("now") Instant now, @Param("redacted") String redacted);
}
