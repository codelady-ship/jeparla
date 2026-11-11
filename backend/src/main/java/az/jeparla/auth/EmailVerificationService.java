package az.jeparla.auth;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.AccountToken.Purpose;
import az.jeparla.auth.AccountTokenService.IssuedToken;
import az.jeparla.common.error.ApiException;
import az.jeparla.notification.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Email verification (#131). Every sign-up with an email address gets a link (24 hours, one use) to that
 * address; opening it sets {@code users.email_verified}. An unverified account works like a verified one
 * (docs/RBAC.md, "Email verification"): the flag tells the frontend to ask for the confirmation, and a reset of the
 * password through the email link verifies the address as well.
 */
@Service
public class EmailVerificationService {

    /** Error code of an unknown, used or expired verification link. */
    static final String INVALID_TOKEN = "auth.verification_token_invalid";

    private final AccountTokenService tokens;
    private final NotificationService notifications;
    private final AccountLinks links;
    private final AccountEmailProperties properties;
    private final UserRepository users;
    private final AuditService audit;

    public EmailVerificationService(AccountTokenService tokens, NotificationService notifications, AccountLinks links,
            AccountEmailProperties properties, UserRepository users, AuditService audit) {
        this.tokens = tokens;
        this.notifications = notifications;
        this.links = links;
        this.properties = properties;
        this.users = users;
        this.audit = audit;
    }

    /** Queues the verification email of a new or changed address; nothing for an account without one. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void send(User user) {
        String email = user.getEmail();
        if (email == null || email.isBlank() || user.isEmailVerified()) {
            return;
        }
        IssuedToken token = tokens.issue(user, Purpose.EMAIL_VERIFICATION, email, null, properties.verificationTtl());
        String link = links.verifyEmail(user.getPreferredLocale(), token.value());
        String hours = String.valueOf(Math.max(1, properties.verificationTtl().toHours()));
        notifications.queueAccountEmail(user, email, "verify_email", locale -> new Object[] {link, hours},
                token.expiresAt());
    }

    /**
     * Sends the link again for the signed-in account. The rate limit is checked by the caller.
     *
     * @throws ApiException 409 {@code auth.no_email} without an address, 409 {@code auth.email_already_verified}
     */
    @Transactional
    public void resend(long userId) {
        User user = users.findWithRolesById(userId)
                .filter(found -> found.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "auth.invalid_token"));
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.no_email");
        }
        if (user.isEmailVerified()) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.email_already_verified");
        }
        send(user);
    }

    /**
     * Confirms the address the link was sent to. Unknown, used and expired links, and a link to an address the
     * account no longer has, all give the same 400 {@value #INVALID_TOKEN}.
     */
    @Transactional
    public void verify(String rawToken) {
        AccountToken token = tokens.use(rawToken, Purpose.EMAIL_VERIFICATION, INVALID_TOKEN);
        User user = token.getUser();
        if (user.getEmail() == null || !user.getEmail().equalsIgnoreCase(token.getEmail())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_TOKEN);
        }
        markVerified(user);
    }

    /**
     * Sets the flag (also after a password reset by email link) and ends the other verification links. The bulk
     * update at the end flushes and detaches the loaded entities, so callers change the user before calling this.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    void markVerified(User user) {
        if (!user.isEmailVerified()) {
            user.setEmailVerified(true);
            audit.recordAs(user, "EMAIL_VERIFIED", AuditTargetType.USER, user.getId(), user.getDisplayName(), null,
                    null);
        }
        tokens.useAllOf(user.getId(), Purpose.EMAIL_VERIFICATION);
    }
}
