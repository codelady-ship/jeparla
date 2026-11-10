package az.jeparla.notification;

import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.User;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.Language;
import az.jeparla.notification.dto.NotificationDto;
import az.jeparla.notification.dto.UnreadCountDto;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.function.Function;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notifications (#138): an in-app notification for the recipient and, when they have an email address, an
 * email in the outbox, both in the recipient's language ({@code users.preferred_locale}) and in the
 * transaction of the event, so a rolled back decision tells nobody anything.
 */
@Service
public class NotificationService {

    private static final int MAX_PAGE_SIZE = 50;

    private final NotificationRepository notifications;
    private final EmailOutboxRepository outbox;
    private final MessageSource messages;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, EmailOutboxRepository outbox,
            MessageSource messages, Clock clock) {
        this.notifications = notifications;
        this.outbox = outbox;
        this.messages = messages;
        this.clock = clock;
    }

    /**
     * Notifies {@code recipient}.
     *
     * @param args the arguments of {@code notification.<kind>.body} for a locale (e.g. a reason in that language)
     * @param note optional free text of the reviewer, added after the body as {@code notification.note}
     * @param link frontend path to act on it, or null
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Notification notify(User recipient, NotificationKind kind, Function<Locale, Object[]> args, String note,
            String link) {
        Language language = recipient.getPreferredLocale();
        Locale locale = Locale.forLanguageTag(language.code());
        String title = messages.getMessage(kind.messageKey() + ".title", null, locale);
        String body = messages.getMessage(kind.messageKey() + ".body", args.apply(locale), locale);
        if (note != null && !note.isBlank()) {
            body = body + "\n\n" + messages.getMessage("notification.note", new Object[] {note.strip()}, locale);
        }
        Notification notification = notifications.save(new Notification(recipient, kind, language, title, body, link));
        if (recipient.getEmail() != null && !recipient.getEmail().isBlank()) {
            String footer = messages.getMessage("notification.email.footer", null, locale);
            outbox.save(new EmailOutboxMessage(notification.getId(), recipient.getId(), recipient.getEmail(), language,
                    title, body + "\n\n" + footer, clock.instant()));
        }
        return notification;
    }

    /** The signed-in user's notifications, newest first. */
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public PageDto<NotificationDto> mine(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "notifications.page");
        }
        return PageDto.of(notifications.findByUserIdOrderByCreatedAtDescIdDesc(CurrentUser.id(),
                PageRequest.of(page, size)), NotificationDto::of);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public UnreadCountDto unread() {
        return new UnreadCountDto(notifications.countByUserIdAndReadAtIsNull(CurrentUser.id()));
    }

    /** Marks one of the user's notifications read; someone else's is 404 (ids are sequential). */
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public NotificationDto markRead(long id) {
        Notification notification = notifications.findByIdAndUserId(id, CurrentUser.id())
                .orElseThrow(ApiException::notFound);
        notification.markRead(clock.instant());
        return NotificationDto.of(notification);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public UnreadCountDto markAllRead() {
        Instant now = clock.instant();
        notifications.markAllRead(CurrentUser.id(), now);
        return new UnreadCountDto(0);
    }
}
