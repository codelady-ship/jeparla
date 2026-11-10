package az.jeparla.notification;

import az.jeparla.auth.User;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.i18n.LanguageConverter;
import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * An in-app notification (#138, V15): the bell in the header. Title and body are rendered once, in the user's
 * language when it happened.
 */
@Entity
@Table(name = "notifications")
public class Notification extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false)
    private NotificationKind kind;

    @Convert(converter = LanguageConverter.class)
    @Column(name = "language", nullable = false, updatable = false)
    private Language language;

    @Column(name = "title", nullable = false, updatable = false)
    private String title;

    @Column(name = "body", nullable = false, updatable = false)
    private String body;

    /** Frontend path to act on it, or null. */
    @Column(name = "link", updatable = false)
    private String link;

    @Column(name = "read_at")
    private Instant readAt;

    protected Notification() {
    }

    Notification(User user, NotificationKind kind, Language language, String title, String body, String link) {
        this.user = user;
        this.kind = kind;
        this.language = language;
        this.title = title;
        this.body = body;
        this.link = link;
    }

    /** Idempotent: the first read time stays. */
    void markRead(Instant now) {
        if (readAt == null) {
            readAt = now;
        }
    }

    public User getUser() {
        return user;
    }

    public NotificationKind getKind() {
        return kind;
    }

    public Language getLanguage() {
        return language;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getLink() {
        return link;
    }

    public Instant getReadAt() {
        return readAt;
    }
}
