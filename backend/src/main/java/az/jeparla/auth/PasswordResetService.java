package az.jeparla.auth;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.AccountToken.Purpose;
import az.jeparla.auth.AccountTokenService.IssuedToken;
import az.jeparla.auth.dto.AdminResetLinkResponse;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.notification.NotificationService;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Password reset (#131).
 *
 * <ul>
 *   <li>{@link #request}: a link (1 hour, one use) to the account's email. The caller answers 202 whatever
 *       happens here, so nobody learns whether an address has an account.</li>
 *   <li>{@link #reset}: sets the new password, ends every session (all refresh token families) and every other
 *       reset link, and verifies the email the link went to.</li>
 *   <li>{@link #issueByAdmin}: a phone-only seller has no email and SMS is not decided (#52); an admin issues the
 *       link and hands it over after checking who is asking (audited).</li>
 * </ul>
 */
@Service
public class PasswordResetService {

    /** Error code of an unknown, used or expired reset link. */
    static final String INVALID_TOKEN = "auth.reset_token_invalid";

    private final UserRepository users;
    private final AccountTokenService tokens;
    private final RefreshTokenService refreshTokens;
    private final EmailVerificationService verification;
    private final NotificationService notifications;
    private final AccountLinks links;
    private final AccountEmailProperties properties;
    private final PasswordEncoder passwordEncoder;
    private final RateLimitService rateLimits;
    private final AuditService audit;

    public PasswordResetService(UserRepository users, AccountTokenService tokens, RefreshTokenService refreshTokens,
            EmailVerificationService verification, NotificationService notifications, AccountLinks links,
            AccountEmailProperties properties, PasswordEncoder passwordEncoder, RateLimitService rateLimits,
            AuditService audit) {
        this.users = users;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.verification = verification;
        this.notifications = notifications;
        this.links = links;
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
        this.rateLimits = rateLimits;
        this.audit = audit;
    }

    /**
     * Queues a reset link when {@code email} belongs to an active account, unless that address had
     * {@link RateLimitPolicy#PASSWORD_FORGOT_ACCOUNT} requests in the window already. The address is counted whether
     * an account exists or not. Never throws for an unknown address and returns nothing the caller could leak.
     */
    @Transactional
    public void request(String email) {
        String address = email.strip().toLowerCase(Locale.ROOT);
        try {
            rateLimits.check(RateLimitPolicy.PASSWORD_FORGOT_ACCOUNT, address);
        } catch (RateLimitExceededException e) {
            // Same answer as any other request: the limit protects the inbox, not the caller.
            return;
        }
        Optional<User> found = users.findByEmailIgnoringCase(address)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE);
        if (found.isEmpty()) {
            return;
        }
        User user = found.get();
        IssuedToken token = tokens.issue(user, Purpose.PASSWORD_RESET, user.getEmail(), null, properties.resetTtl());
        String link = links.resetPassword(user.getPreferredLocale(), token.value());
        String minutes = String.valueOf(Math.max(1, properties.resetTtl().toMinutes()));
        notifications.queueAccountEmail(user, user.getEmail(), "reset_password",
                locale -> new Object[] {link, minutes},
                token.expiresAt());
        audit.recordAs(user, "PASSWORD_RESET_REQUESTED", AuditTargetType.USER, user.getId(), user.getDisplayName(),
                null, null);
    }

    /**
     * Sets a new password with a reset link. Unknown, used and expired links, a link to an email the account no
     * longer has, and a blocked account all give the same 400 {@value #INVALID_TOKEN}. The password rules are
     * checked by the request DTO (as at sign-up).
     *
     * @return how many sessions (refresh tokens) were ended
     */
    @Transactional
    public int reset(String rawToken, String newPassword) {
        AccountToken token = tokens.use(rawToken, Purpose.PASSWORD_RESET, INVALID_TOKEN);
        User user = token.getUser();
        boolean byEmail = token.getEmail() != null;
        if (user.getStatus() != UserStatus.ACTIVE
                || (byEmail && (user.getEmail() == null || !user.getEmail().equalsIgnoreCase(token.getEmail())))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_TOKEN);
        }
        long userId = user.getId();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        audit.recordAs(user, "PASSWORD_RESET", AuditTargetType.USER, userId, user.getDisplayName(), null,
                "{\"via\":\"" + (byEmail ? "email" : "admin_link") + "\"}");
        if (byEmail) {
            // The link reached this inbox: the address is the owner's.
            verification.markVerified(user);
        }
        // Bulk updates last: they flush the changes above and detach the entities.
        tokens.useAllOf(userId, Purpose.PASSWORD_RESET);
        return refreshTokens.revokeAllOf(userId);
    }

    /**
     * Issues a reset link for an account without a usable email (phone-only seller) that the admin hands over
     * after checking, on the account's phone, who is asking. Not for admins (they use their email) and not for an
     * account with a verified email (it resets itself).
     *
     * @throws ApiException 404 {@code not_found}, 409 {@code auth.reset_link_not_allowed}
     */
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public AdminResetLinkResponse issueByAdmin(long userId) {
        long adminId = CurrentUser.id();
        User user = users.findWithRolesById(userId).orElseThrow(ApiException::notFound);
        if (user.hasRole(RoleName.ADMIN) || user.isEmailVerified() || user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.reset_link_not_allowed");
        }
        IssuedToken token = tokens.issue(user, Purpose.PASSWORD_RESET, null, adminId, properties.resetTtl());
        audit.record("PASSWORD_RESET_LINK_ISSUED", AuditTargetType.USER, user.getId(), user.getDisplayName(), null,
                "{\"expiresAt\":\"" + token.expiresAt() + "\"}");
        return new AdminResetLinkResponse(links.resetPassword(user.getPreferredLocale(), token.value()),
                token.expiresAt());
    }
}
