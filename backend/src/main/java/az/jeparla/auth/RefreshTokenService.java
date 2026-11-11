package az.jeparla.auth;

import az.jeparla.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh tokens: 256 random bits, base64url, sent to the browser once and stored only as a
 * SHA-256 hash. Each refresh rotates the token; presenting a used or revoked token again revokes
 * the whole family (reuse detection, RFC 9700 section 4.14.2).
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository tokens;
    private final AuthProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository tokens, AuthProperties properties, Clock clock) {
        this.tokens = tokens;
        this.properties = properties;
        this.clock = clock;
    }

    /** First token of a new family (login, register); the family ends {@code refresh-family-ttl} from now. */
    @Transactional
    public IssuedRefreshToken startFamily(User user) {
        return issue(user, UUID.randomUUID(), clock.instant().plus(properties.refreshFamilyTtl()));
    }

    /**
     * Exchanges a token for the next one of its family.
     *
     * <p>Not rolled back on {@link ApiException}: the family revocation of a reuse must be committed
     * although the request fails.
     *
     * <p>The next token never outlives the family (#134): a session ends {@code refresh-family-ttl} after its
     * login however often it is refreshed, and the whole family is revoked then.
     *
     * @throws ApiException 401 {@code auth.refresh_invalid} for an unknown, expired, used or revoked token, or
     *                      one of an expired family
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Rotation rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalid();
        }
        Instant now = clock.instant();
        RefreshToken token = tokens.findByTokenHashForUpdate(hash(rawToken)).orElseThrow(RefreshTokenService::invalid);
        if (token.isSpent()) {
            int revoked = tokens.revokeFamily(token.getFamilyId(), now);
            // No token value in the log, only ids.
            log.warn("Refresh token reuse detected: user {}, family {}, {} token(s) revoked",
                    token.getUser().getId(), token.getFamilyId(), revoked);
            throw invalid();
        }
        if (!token.getFamilyExpiresAt().isAfter(now)) {
            tokens.revokeFamily(token.getFamilyId(), now);
            log.info("Refresh token family {} of user {} reached its absolute lifetime",
                    token.getFamilyId(), token.getUser().getId());
            throw invalid();
        }
        if (token.isExpired(now)) {
            token.revoke(now);
            throw invalid();
        }
        token.markUsed(now);
        IssuedRefreshToken next = issue(token.getUser(), token.getFamilyId(), token.getFamilyExpiresAt());
        return new Rotation(token.getUser(), next);
    }

    /** Logout: revokes the family of the presented token. Unknown tokens are ignored. */
    @Transactional
    public void revokeFamilyOf(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        tokens.findByTokenHash(hash(rawToken))
                .ifPresent(token -> tokens.revokeFamily(token.getFamilyId(), clock.instant()));
    }

    /** Signs a user out everywhere (account blocked by an admin, #40). */
    @Transactional
    public int revokeAllOf(long userId) {
        return tokens.revokeAllOfUser(userId, clock.instant());
    }

    /**
     * Daily cleanup of tokens that expired more than a day ago; a token never outlives its family, so the rows
     * of ended sessions go too. Used and revoked tokens stay until then for reuse detection.
     */
    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Baku")
    @Transactional
    public void deleteExpired() {
        int deleted = tokens.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(1)));
        if (deleted > 0) {
            log.info("Deleted {} expired refresh token(s)", deleted);
        }
    }

    private IssuedRefreshToken issue(User user, UUID familyId, Instant familyExpiresAt) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = clock.instant().plus(properties.refreshTokenTtl());
        if (expiresAt.isAfter(familyExpiresAt)) {
            expiresAt = familyExpiresAt;
        }
        tokens.save(new RefreshToken(user, familyId, hash(raw), expiresAt, familyExpiresAt));
        return new IssuedRefreshToken(raw, expiresAt);
    }

    static String hash(String rawToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "auth.refresh_invalid");
    }

    /** A new token: {@code value} goes to the cookie only. */
    public record IssuedRefreshToken(String value, Instant expiresAt) {

        @Override
        public String toString() {
            return "IssuedRefreshToken[value=***, expiresAt=" + expiresAt + "]";
        }
    }

    public record Rotation(User user, IssuedRefreshToken next) {
    }
}
