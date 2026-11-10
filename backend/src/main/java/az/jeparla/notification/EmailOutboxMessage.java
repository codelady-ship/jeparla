package az.jeparla.notification;

import az.jeparla.common.i18n.Language;
import az.jeparla.common.i18n.LanguageConverter;
import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;

/**
 * An email waiting to be sent (V15): written in the transaction of the event, sent afterwards by
 * {@link EmailOutboxJob}. The row stays as the record of what was sent.
 */
@Entity
@Table(name = "email_outbox")
public class EmailOutboxMessage extends LongIdEntity {

    /** Attempts before a message is given up (FAILED). */
    static final int MAX_ATTEMPTS = 5;

    public enum Status {
        PENDING,
        SENT,
        FAILED
    }

    @Column(name = "notification_id", updatable = false)
    private Long notificationId;

    @Column(name = "user_id", updatable = false)
    private Long userId;

    @Column(name = "to_address", nullable = false, updatable = false)
    private String toAddress;

    @Convert(converter = LanguageConverter.class)
    @Column(name = "language", nullable = false, updatable = false)
    private Language language;

    @Column(name = "subject", nullable = false, updatable = false)
    private String subject;

    @Column(name = "body", nullable = false, updatable = false)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    protected EmailOutboxMessage() {
    }

    EmailOutboxMessage(Long notificationId, Long userId, String toAddress, Language language, String subject,
            String body, Instant now) {
        this.notificationId = notificationId;
        this.userId = userId;
        this.toAddress = toAddress;
        this.language = language;
        this.subject = subject;
        this.body = body;
        this.createdAt = now;
        this.nextAttemptAt = now;
    }

    void sent(Instant now) {
        this.status = Status.SENT;
        this.attempts++;
        this.sentAt = now;
        this.lastError = null;
    }

    /** A failed attempt: retried later with a growing pause, given up after {@value #MAX_ATTEMPTS}. */
    void failed(String error, Instant now) {
        this.attempts++;
        this.lastError = error == null ? null : error.substring(0, Math.min(error.length(), 500));
        if (attempts >= MAX_ATTEMPTS) {
            this.status = Status.FAILED;
        } else {
            this.nextAttemptAt = now.plus(Duration.ofMinutes(5L * attempts * attempts));
        }
    }

    public Long getNotificationId() {
        return notificationId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getToAddress() {
        return toAddress;
    }

    public Language getLanguage() {
        return language;
    }

    public String getSubject() {
        return subject;
    }

    public String getBody() {
        return body;
    }

    public Status getStatus() {
        return status;
    }

    public int getAttempts() {
        return attempts;
    }

    public Instant getNextAttemptAt() {
        return nextAttemptAt;
    }
}
