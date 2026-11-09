package az.jeparla.auth;

import az.jeparla.auth.AuthService.Session;
import az.jeparla.auth.dto.AuthResponse;
import az.jeparla.auth.dto.LoginRequest;
import az.jeparla.auth.dto.MerchantRegisterRequest;
import az.jeparla.auth.dto.RegisterRequest;
import az.jeparla.auth.dto.UserResponse;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Locale;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/v1/auth}: register, login, refresh, logout, me.
 *
 * <p>The access token is returned in the body and sent back as {@code Authorization: Bearer}. The
 * refresh token travels only in the {@value #REFRESH_COOKIE} cookie: httpOnly (no script can read
 * it), Secure, {@code SameSite=Strict}, and {@code Path=/api/v1/auth} (sent to nothing else).
 */
@RestController
@RequestMapping(AuthController.BASE)
public class AuthController {

    static final String BASE = "/api/v1/auth";
    public static final String REFRESH_COOKIE = "jeparla_refresh";

    private final AuthService auth;
    private final AuthProperties properties;
    private final RateLimitService rateLimits;
    private final LoginThrottle loginThrottle;

    public AuthController(AuthService auth, AuthProperties properties, RateLimitService rateLimits,
            LoginThrottle loginThrottle) {
        this.auth = auth;
        this.properties = properties;
        this.rateLimits = rateLimits;
        this.loginThrottle = loginThrottle;
    }

    /**
     * Rate-limit key of the client: the address {@code ClientIpFilter} resolved (X-Forwarded-For
     * only from trusted proxies), an IPv6 client by its /64 network.
     */
    private static String clientKey(HttpServletRequest request) {
        return IpAddresses.rateLimitKey(request.getRemoteAddr());
    }

    /** The same account in any spelling: lowercase email, or the E.164 phone. */
    private static String accountKey(String login) {
        String value = login.strip();
        String phone = value.contains("@") ? null : PhoneNumbers.normalize(value);
        return phone != null ? phone : value.toLowerCase(Locale.ROOT);
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest body, HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.REGISTER_IP, clientKey(request));
        rateLimits.check(RateLimitPolicy.REGISTER_ACCOUNT, body.email());
        return respond(HttpStatus.CREATED, auth.registerUser(body, LocaleContextHolder.getLocale()));
    }

    @PostMapping("/register/merchant")
    public ResponseEntity<AuthResponse> registerMerchant(@Valid @RequestBody MerchantRegisterRequest body,
            HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.REGISTER_IP, clientKey(request));
        rateLimits.check(RateLimitPolicy.REGISTER_ACCOUNT, PhoneNumbers.normalize(body.phone()));
        return respond(HttpStatus.CREATED, auth.registerMerchant(body, LocaleContextHolder.getLocale()));
    }

    /**
     * Limited per IP (every attempt) and per account (failed attempts only), see {@link LoginThrottle}:
     * a stranger's wrong passwords never block the owner's right one.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        String address = clientKey(request);
        String account = accountKey(body.login());
        loginThrottle.beforeAttempt(account, address);
        Session session;
        try {
            session = auth.login(body);
        } catch (ApiException e) {
            if (AuthService.INVALID_CREDENTIALS.equals(e.code())) {
                loginThrottle.failed(account, address);
            }
            throw e;
        }
        loginThrottle.succeeded(account, address);
        return respond(HttpStatus.OK, session);
    }

    /**
     * New access token and a rotated refresh cookie. 401 clears the cookie. Limited per IP only:
     * the token is 256 random bits (nothing to guess) and names no account until it is verified.
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken, HttpServletRequest request) {
        rateLimits.check(RateLimitPolicy.REFRESH_IP, clientKey(request));
        try {
            return respond(HttpStatus.OK, auth.refresh(refreshToken));
        } catch (ApiException e) {
            throw e.withHeader(HttpHeaders.SET_COOKIE, clearCookie().toString());
        }
    }

    /** Ends the session: revokes the refresh token family and clears the cookie. Always 204. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        auth.logout(refreshToken);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clearCookie().toString()).build();
    }

    @GetMapping("/me")
    public UserResponse me() {
        return auth.me(CurrentUser.id());
    }

    private ResponseEntity<AuthResponse> respond(HttpStatus status, Session session) {
        ResponseCookie cookie = refreshCookie(session.refreshToken().value(), properties.refreshTokenTtl());
        AuthResponse body = new AuthResponse(session.accessToken().value(), session.accessToken().expiresIn(),
                session.user());
        return ResponseEntity.status(status).header(HttpHeaders.SET_COOKIE, cookie.toString()).body(body);
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(properties.cookieSecure())
                .sameSite("Strict")
                .path(BASE)
                .maxAge(maxAge)
                .build();
    }

    private ResponseCookie clearCookie() {
        return refreshCookie("", Duration.ZERO);
    }
}
