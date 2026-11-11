package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import az.jeparla.admin.AuditService;
import az.jeparla.auth.AccountToken.Purpose;
import az.jeparla.auth.AccountTokenService.IssuedToken;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.notification.NotificationService;
import az.jeparla.notification.SupportProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/** Password reset logic (#131) without a database: what is written for known, unknown and limited addresses. */
class PasswordResetServiceTests {

    private static final Instant EXPIRES = Instant.parse("2026-11-10T10:00:00Z");

    private final UserRepository users = mock(UserRepository.class);
    private final AccountTokenService tokens = mock(AccountTokenService.class);
    private final RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
    private final EmailVerificationService verification = mock(EmailVerificationService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final RateLimitService limits = mock(RateLimitService.class);
    private final AuditService audit = mock(AuditService.class);
    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        AccountLinks links = new AccountLinks(new SupportProperties("", "", "/help", "https://jeparla.az"));
        service = new PasswordResetService(users, tokens, refreshTokens, verification, notifications, links,
                new AccountEmailProperties(Duration.ofHours(24), Duration.ofHours(1), Duration.ZERO), encoder,
                limits, audit);
        when(encoder.encode(anyString())).thenReturn("{bcrypt}hash");
        when(tokens.issue(any(), any(), any(), any(), any())).thenReturn(new IssuedToken("raw-token", EXPIRES));
    }

    private static User user(String email, UserStatus status) {
        User user = new User(email, null, "{bcrypt}old", "Aysel");
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setStatus(status);
        return user;
    }

    @Test
    void anUnknownAddressWritesNothing() {
        when(users.findByEmailIgnoringCase("nobody@jeparla.test")).thenReturn(Optional.empty());
        service.request(" Nobody@Jeparla.test ");
        verify(limits).check(RateLimitPolicy.PASSWORD_FORGOT_ACCOUNT, "nobody@jeparla.test");
        verifyNoInteractions(tokens, notifications, audit);
    }

    @Test
    void aKnownAddressGetsALinkInItsLanguage() {
        when(users.findByEmailIgnoringCase("aysel@jeparla.test"))
                .thenReturn(Optional.of(user("aysel@jeparla.test", UserStatus.ACTIVE)));
        service.request("aysel@jeparla.test");
        verify(tokens).issue(any(), eq(Purpose.PASSWORD_RESET), eq("aysel@jeparla.test"), eq(null),
                eq(Duration.ofHours(1)));
        verify(notifications).queueAccountEmail(any(), eq("aysel@jeparla.test"), eq("reset_password"), any(),
                eq(EXPIRES));
        verify(audit).recordAs(any(), eq("PASSWORD_RESET_REQUESTED"), any(), any(), any(), any(), any());
    }

    @Test
    void overTheAddressLimitNothingIsWrittenAndNothingIsThrown() {
        doThrow(new RateLimitExceededException(60)).when(limits)
                .check(RateLimitPolicy.PASSWORD_FORGOT_ACCOUNT, "aysel@jeparla.test");
        service.request("aysel@jeparla.test");
        verify(users, never()).findByEmailIgnoringCase(anyString());
        verifyNoInteractions(tokens, notifications, audit);
    }

    @Test
    void aBlockedAccountGetsNoLink() {
        when(users.findByEmailIgnoringCase("aysel@jeparla.test"))
                .thenReturn(Optional.of(user("aysel@jeparla.test", UserStatus.BLOCKED)));
        service.request("aysel@jeparla.test");
        verifyNoInteractions(tokens, notifications, audit);
    }

    private AccountToken token(User user, String email) {
        return new AccountToken(user, Purpose.PASSWORD_RESET, "0".repeat(64), email, null, EXPIRES.minusSeconds(60),
                EXPIRES);
    }

    @Test
    void aResetSetsThePasswordAndEndsEverySession() {
        User user = user("aysel@jeparla.test", UserStatus.ACTIVE);
        when(tokens.use("raw", Purpose.PASSWORD_RESET, PasswordResetService.INVALID_TOKEN))
                .thenReturn(token(user, "aysel@jeparla.test"));
        when(refreshTokens.revokeAllOf(7L)).thenReturn(3);

        assertThat(service.reset("raw", "parol456")).isEqualTo(3);
        assertThat(user.getPasswordHash()).isEqualTo("{bcrypt}hash");
        verify(refreshTokens).revokeAllOf(7L);
        verify(tokens).useAllOf(7L, Purpose.PASSWORD_RESET);
        verify(verification).markVerified(user);
    }

    @Test
    void aLinkToAnOldAddressOrABlockedAccountIsRefused() {
        User moved = user("new@jeparla.test", UserStatus.ACTIVE);
        when(tokens.use("moved", Purpose.PASSWORD_RESET, PasswordResetService.INVALID_TOKEN))
                .thenReturn(token(moved, "old@jeparla.test"));
        assertThatThrownBy(() -> service.reset("moved", "parol456")).isInstanceOf(ApiException.class)
                .hasMessage(PasswordResetService.INVALID_TOKEN);

        User blocked = user("aysel@jeparla.test", UserStatus.BLOCKED);
        when(tokens.use("blocked", Purpose.PASSWORD_RESET, PasswordResetService.INVALID_TOKEN))
                .thenReturn(token(blocked, "aysel@jeparla.test"));
        assertThatThrownBy(() -> service.reset("blocked", "parol456")).isInstanceOf(ApiException.class)
                .hasMessage(PasswordResetService.INVALID_TOKEN);

        verify(refreshTokens, never()).revokeAllOf(anyLong());
        verify(encoder, never()).encode(anyString());
    }

    @Test
    void anAdminLinkDoesNotVerifyAnEmail() {
        User seller = new User(null, "+994501234567", "{bcrypt}old", "Zərgər");
        ReflectionTestUtils.setField(seller, "id", 9L);
        when(tokens.use("admin", Purpose.PASSWORD_RESET, PasswordResetService.INVALID_TOKEN))
                .thenReturn(token(seller, null));
        service.reset("admin", "parol456");
        verify(refreshTokens).revokeAllOf(9L);
        verify(verification, never()).markVerified(any());
    }
}
