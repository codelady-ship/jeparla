package az.jeparla.auth;

import az.jeparla.auth.dto.AdminResetLinkResponse;
import az.jeparla.auth.dto.ForgotPasswordRequest;
import az.jeparla.auth.dto.ResetPasswordRequest;
import az.jeparla.auth.dto.VerifyEmailRequest;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Password reset and email verification (#131), docs/RBAC.md "Password reset and email verification".
 *
 * <ul>
 *   <li>{@code POST /api/v1/auth/password/forgot} (public): always 202 with no body, whether the address has an
 *       account or not, after at least {@code forgot-response-floor}.</li>
 *   <li>{@code POST /api/v1/auth/password/reset} (public): 204; every session of the account ends.</li>
 *   <li>{@code POST /api/v1/auth/email/verify} (public: the link may open in another browser): 204.</li>
 *   <li>{@code POST /api/v1/auth/email/verification} (signed in): sends the link again, 202.</li>
 *   <li>{@code POST /api/v1/admin/users/{id}/password-reset-link} (ADMIN): a link for a phone-only seller.</li>
 * </ul>
 */
@RestController
public class AccountRecoveryController {

    static final String FORGOT = AuthController.BASE + "/password/forgot";
    static final String RESET = AuthController.BASE + "/password/reset";
    static final String VERIFY = AuthController.BASE + "/email/verify";
    static final String RESEND = AuthController.BASE + "/email/verification";
    static final String ADMIN_RESET_LINK = "/api/v1/admin/users/{id}/password-reset-link";

    private static final Logger log = LoggerFactory.getLogger(AccountRecoveryController.class);

    private final PasswordResetService resets;
    private final EmailVerificationService verification;
    private final RateLimitService rateLimits;
    private final AccountEmailProperties properties;
    private final AuthProperties authProperties;

    public AccountRecoveryController(PasswordResetService resets, EmailVerificationService verification,
            RateLimitService rateLimits, AccountEmailProperties properties, AuthProperties authProperties) {
        this.resets = resets;
        this.verification = verification;
        this.rateLimits = rateLimits;
        this.properties = properties;
        this.authProperties = authProperties;
    }

    private static String clientKey(HttpServletRequest request) {
        return IpAddresses.rateLimitKey(request.getRemoteAddr());
    }

    /**
     * 202 for every well-formed request, known address or not. Only the per-IP limit answers 429 (keyed by the
     * caller, so it says nothing about the address). The work for a known address (token, outbox, audit) is
     * hidden behind a fixed minimum answer time.
     */
    @PostMapping(FORGOT)
    public ResponseEntity<Void> forgot(@Valid @RequestBody ForgotPasswordRequest body, HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.PASSWORD_FORGOT_IP, clientKey(request));
        long started = System.nanoTime();
        try {
            resets.request(body.email());
        } catch (RuntimeException e) {
            // Even a failure answers the same: the client must not learn anything from it.
            log.warn("Password reset request failed: {}", e.getClass().getSimpleName());
        }
        waitUntil(started, properties.forgotResponseFloor());
        return ResponseEntity.accepted().build();
    }

    /** 204 and a cleared refresh cookie: the new password signs in again everywhere. */
    @PostMapping(RESET)
    public ResponseEntity<Void> reset(@Valid @RequestBody ResetPasswordRequest body, HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.PASSWORD_RESET_IP, clientKey(request));
        resets.reset(body.token(), body.password());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString()).build();
    }

    @PostMapping(VERIFY)
    public ResponseEntity<Void> verify(@Valid @RequestBody VerifyEmailRequest body, HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.EMAIL_VERIFY_IP, clientKey(request));
        verification.verify(body.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping(RESEND)
    public ResponseEntity<Void> resend() {
        long userId = CurrentUser.id();
        rateLimits.check(RateLimitPolicy.EMAIL_VERIFICATION_ACCOUNT, "user:" + userId);
        verification.resend(userId);
        return ResponseEntity.accepted().build();
    }

    @PostMapping(ADMIN_RESET_LINK)
    public AdminResetLinkResponse adminResetLink(@PathVariable("id") long id) {
        return resets.issueByAdmin(id);
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(AuthController.REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(authProperties.cookieSecure())
                .sameSite("Strict")
                .path(AuthController.BASE)
                .maxAge(Duration.ZERO)
                .build();
    }

    private static void waitUntil(long startedNanos, Duration floor) {
        long remaining = floor.toNanos() - (System.nanoTime() - startedNanos);
        if (remaining <= 0) {
            return;
        }
        try {
            Thread.sleep(Duration.ofNanos(remaining));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
