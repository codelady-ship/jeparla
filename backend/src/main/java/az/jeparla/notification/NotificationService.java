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
    private final SupportProperties support;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, EmailOutboxRepository outbox,
            MessageSource messages, SupportProperties support, Clock clock) {
        this.notifications = notifications;
        this.outbox = outbox;
        this.messages = messages;
        this.support = support;
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
        if (kind.supportContact()) {
            body = body + "\n\n" + supportLine(locale);
        }
        Notification notification = notifications.save(new Notification(recipient, kind, language, title, body, link));
        if (recipient.getEmail() != null && !recipient.getEmail().isBlank()) {
            String footer = messages.getMessage("notification.email.footer", null, locale);
            outbox.save(new EmailOutboxMessage(notification.getId(), recipient.getId(), recipient.getEmail(), language,
                    title, body + "\n\n" + footer, clock.instant()));
        }
        return notification;
    }

    /**
     * Queues an account email with a one-time link (#131): email verification or password reset. Email only, in
     * the recipient's language: no in-app notification, which would keep the link in {@code notifications}. The
     * body loses the link once the email is sent or the link expires ({@link EmailOutboxMessage#REDACTED_BODY}).
     *
     * @param to        address the link goes to (the account's email)
     * @param kind      {@code email.<kind>.subject} and {@code email.<kind>.body} in the message files
     * @param args      arguments of the body for a locale
     * @param expiresAt when the link stops working
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void queueAccountEmail(User recipient, String to, String kind, Function<Locale, Object[]> args,
            Instant expiresAt) {
        Language language = recipient.getPreferredLocale();
        Locale locale = Locale.forLanguageTag(language.code());
        String subject = messages.getMessage("email." + kind + ".subject", null, locale);
        String body = messages.getMessage("email." + kind + ".body", args.apply(locale), locale) + "\n\n"
                + messages.getMessage("email.account.footer", null, locale);
        outbox.save(EmailOutboxMessage.oneTimeLink(recipient.getId(), to, language, subject, body, clock.instant(),
                expiresAt));
    }

    /** Gives up and redacts one-time link emails whose link has expired (#131). Returns how many were redacted. */
    @Transactional
    public int redactExpiredLinks() {
        Instant now = clock.instant();
        outbox.giveUpExpired(now);
        return outbox.redactExpired(now, EmailOutboxMessage.REDACTED_BODY);
    }

    /**
     * Where to turn (#138): the configured support email and URL, or else the in-app help page. The email is
     * read outside the site, so "contact support" alone would not tell the seller where to write.
     */
    private String supportLine(Locale locale) {
        if (support.hasContact()) {
            return messages.getMessage("notification.support", new Object[] {support.contact()}, locale);
        }
        return messages.getMessage("notification.support.help", new Object[] {support.helpPath()}, locale);
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
