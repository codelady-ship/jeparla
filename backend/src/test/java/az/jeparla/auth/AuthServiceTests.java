package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.auth.dto.LoginRequest;
import az.jeparla.common.error.ApiException;
import java.time.Clock;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Login without a database: unknown accounts and wrong passwords take the same path (one BCrypt
 * comparison) and end in the same error, so neither the answer nor its timing tells them apart.
 */
class AuthServiceTests {

    private static final String DUMMY_HASH = "{bcrypt}dummy";
    private static final String REAL_HASH = "{bcrypt}real";

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
    private AuthService auth;

    @BeforeEach
    void setUp() {
        when(encoder.encode(anyString())).thenReturn(DUMMY_HASH);
        auth = new AuthService(users, mock(RoleRepository.class), encoder, mock(AccessTokenService.class),
                refreshTokens, Clock.systemUTC(), mock(EmailVerificationService.class));
    }

    private static User user(UserStatus status) {
        User user = new User("aysel@jeparla.test", null, REAL_HASH, "Aysel");
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setStatus(status);
        return user;
    }

    private ApiException loginFails(String login, String password) {
        return catchThrowableOfType(ApiException.class, () -> auth.login(new LoginRequest(login, password)));
    }

    @Test
    void unknownEmailStillRunsOnePasswordComparison() {
        when(users.findByEmailIgnoringCase("nobody@jeparla.test")).thenReturn(Optional.empty());

        ApiException error = loginFails("nobody@jeparla.test", "parol123");

        verify(encoder, times(1)).matches("parol123", DUMMY_HASH);
        assertThat(error.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(error.code()).isEqualTo("auth.invalid_credentials");
    }

    @Test
    void wrongPasswordRunsOnePasswordComparisonAndFailsTheSameWay() {
        when(users.findByEmailIgnoringCase("aysel@jeparla.test")).thenReturn(Optional.of(user(UserStatus.ACTIVE)));
        when(encoder.matches("parol999", REAL_HASH)).thenReturn(false);

        ApiException error = loginFails("aysel@jeparla.test", "parol999");

        verify(encoder, times(1)).matches("parol999", REAL_HASH);
        assertThat(error.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(error.code()).isEqualTo("auth.invalid_credentials");
        assertThat(error.field()).isNull();
    }

    @Test
    void unknownPhoneAndUnparsableLoginRunTheComparisonToo() {
        when(users.findByPhone("+994501234567")).thenReturn(Optional.empty());

        assertThat(loginFails("050 123 45 67", "parol123").code()).isEqualTo("auth.invalid_credentials");
        assertThat(loginFails("not-a-login", "parol123").code()).isEqualTo("auth.invalid_credentials");

        verify(encoder, times(2)).matches("parol123", DUMMY_HASH);
    }

    @Test
    void passwordOverBcryptLimitNeverMatchesButCostsTheSame() {
        when(users.findByEmailIgnoringCase("aysel@jeparla.test")).thenReturn(Optional.of(user(UserStatus.ACTIVE)));
        String tooLong = "ə".repeat(40) + "1";

        assertThat(loginFails("aysel@jeparla.test", tooLong).code()).isEqualTo("auth.invalid_credentials");

        verify(encoder, never()).matches(tooLong, REAL_HASH);
        verify(encoder, times(1)).matches("", DUMMY_HASH);
    }

    @Test
    void blockedAccountIsReportedOnlyAfterTheRightPassword() {
        when(users.findByEmailIgnoringCase("aysel@jeparla.test")).thenReturn(Optional.of(user(UserStatus.BLOCKED)));
        when(encoder.matches("parol123", REAL_HASH)).thenReturn(true);

        assertThat(loginFails("aysel@jeparla.test", "parol999").code()).isEqualTo("auth.invalid_credentials");
        ApiException blocked = loginFails("aysel@jeparla.test", "parol123");
        assertThat(blocked.status()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(blocked.code()).isEqualTo("auth.account_blocked");
        verify(refreshTokens, never()).startFamily(org.mockito.ArgumentMatchers.any());
    }
}
