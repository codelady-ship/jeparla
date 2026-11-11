package az.jeparla.auth;

import az.jeparla.auth.AccountToken.Purpose;
import az.jeparla.common.error.ApiException;
import az.jeparla.notification.NotificationService;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-time account tokens (#131): 256 random bits, base64url, sent once in a link and stored only as a SHA-256
 * hash (as refresh tokens). A token is used at most once, within its lifetime, for its own purpose.
 */
@Service
public class AccountTokenService {

    private static final Logger log = LoggerFactory.getLogger(AccountTokenService.class);
    private static final int TOKEN_BYTES = 32;

    private final AccountTokenRepository tokens;
    private final NotificationService notifications;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AccountTokenService(AccountTokenRepository tokens, NotificationService notifications, Clock clock) {
        this.tokens = tokens;
        this.notifications = notifications;
        this.clock = clock;
    }

    /**
     * Stores the hash of a new token and returns the token, which only goes into the link.
     *
     * @param email    the address the link goes to, or null for a link an admin hands over
     * @param issuedBy the admin who issues it, or null
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public IssuedToken issue(User user, Purpose purpose, String email, Long issuedBy, Duration ttl) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = clock.instant();
        Instant expiresAt = now.plus(ttl);
        tokens.save(new AccountToken(user, purpose, RefreshTokenService.hash(raw), email, issuedBy, now, expiresAt));
        return new IssuedToken(raw, expiresAt);
    }

    /**
     * Uses a token: marks it used and returns it (row locked until the transaction ends).
     *
     * @param invalidCode error code of an unknown, used, expired or wrong-purpose token (all the same 400)
     * @throws ApiException 400 {@code invalidCode}
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public AccountToken use(String rawToken, Purpose purpose, String invalidCode) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 128) {
            throw new ApiException(HttpStatus.BAD_REQUEST, invalidCode);
        }
        Instant now = clock.instant();
        AccountToken token = tokens.findForUpdate(RefreshTokenService.hash(rawToken.strip()), purpose)
                .filter(found -> found.isUsable(now))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, invalidCode));
        token.markUsed(now);
        return token;
    }

    /** Marks every open token of the user for {@code purpose} used: one success ends all other links. */
    @Transactional(propagation = Propagation.MANDATORY)
    public int useAllOf(long userId, Purpose purpose) {
        return tokens.useAllOf(userId, purpose, clock.instant());
    }

    /**
     * Hourly: deletes tokens that expired more than a day ago and removes expired links from the email outbox
     * (also while no email provider sends anything).
     */
    @Scheduled(cron = "${jeparla.auth.account-email.cleanup-cron:0 40 * * * *}", zone = "Asia/Baku")
    @Transactional
    public void cleanup() {
        int deleted = tokens.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
        int redacted = notifications.redactExpiredLinks();
        if (deleted + redacted > 0) {
            log.info("Account tokens: {} expired deleted, {} outbox link(s) removed", deleted, redacted);
        }
    }

    /** A new token: {@code value} goes into the link only, never into a log. */
    public record IssuedToken(String value, Instant expiresAt) {

        @Override
        public String toString() {
            return "IssuedToken[value=***, expiresAt=" + expiresAt + "]";
        }
    }
}
