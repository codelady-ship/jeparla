package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.auth.RefreshTokenService.IssuedRefreshToken;
import az.jeparla.common.error.ApiException;
import az.jeparla.support.MetalPriceJobTest.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Absolute session lifetime (#134) without a database: rotation keeps a session alive only until its family
 * ends, the last token is cut to the family's end, and a token of an ended family revokes the family. The
 * database side (V18, the cookie) is in AuthFlowTests.
 */
class RefreshTokenFamilyTests {

    private static final Instant LOGIN = Instant.parse("2026-11-10T08:00:00Z");

    private final MutableClock clock = new MutableClock(LOGIN);
    private final RefreshTokenRepository tokens = mock(RefreshTokenRepository.class);
    private final Map<String, RefreshToken> stored = new HashMap<>();
    private final RefreshTokenService service = new RefreshTokenService(tokens,
            new AuthProperties("0123456789abcdef0123456789abcdef", Duration.ofMinutes(15), Duration.ofDays(30),
                    Duration.ofDays(90), true),
            clock);
    private final User user = new User("aysel@example.az", null, "{bcrypt}x", "Aysel");

    RefreshTokenFamilyTests() {
        when(tokens.save(any())).thenAnswer(call -> {
            RefreshToken token = call.getArgument(0);
            stored.put(token.getTokenHash(), token);
            return token;
        });
        when(tokens.findByTokenHashForUpdate(anyString()))
                .thenAnswer(call -> Optional.ofNullable(stored.get(call.<String>getArgument(0))));
    }

    private RefreshToken row(IssuedRefreshToken issued) {
        return stored.get(RefreshTokenService.hash(issued.value()));
    }

    @Test
    void refreshingNeverExtendsASessionPastNinetyDays() {
        IssuedRefreshToken token = service.startFamily(user);
        assertThat(token.expiresAt()).isEqualTo(LOGIN.plus(Duration.ofDays(30)));
        UUID family = row(token).getFamilyId();

        // Refreshed every 29 days: each new token has 30 days, but never beyond day 90.
        for (int day : new int[] {29, 58, 87}) {
            clock.set(LOGIN.plus(Duration.ofDays(day)));
            token = service.rotate(token.value()).next();
            assertThat(row(token).getFamilyId()).isEqualTo(family);
            assertThat(row(token).getFamilyExpiresAt()).isEqualTo(LOGIN.plus(Duration.ofDays(90)));
        }
        assertThat(token.expiresAt()).isEqualTo(LOGIN.plus(Duration.ofDays(90)));

        clock.set(LOGIN.plus(Duration.ofDays(90)).plusSeconds(1));
        String last = token.value();
        assertThatExceptionOfType(ApiException.class).isThrownBy(() -> service.rotate(last))
                .satisfies(e -> assertThat(e.code()).isEqualTo("auth.refresh_invalid"));
        verify(tokens).revokeFamily(family, clock.instant());
    }

    @Test
    void withinItsLifetimeASessionIsRefreshedAsBefore() {
        IssuedRefreshToken token = service.startFamily(user);
        clock.set(LOGIN.plus(Duration.ofDays(10)));
        IssuedRefreshToken next = service.rotate(token.value()).next();
        assertThat(next.expiresAt()).isEqualTo(LOGIN.plus(Duration.ofDays(40)));
        assertThat(row(token).getUsedAt()).isEqualTo(clock.instant());
        verify(tokens, never()).revokeFamily(any(), any());
    }

    @Test
    void aTokenCannotOutliveItsFamily() {
        assertThatExceptionOfType(IllegalArgumentException.class).isThrownBy(() -> new RefreshToken(user,
                UUID.randomUUID(), "0".repeat(64), LOGIN.plus(Duration.ofDays(91)), LOGIN.plus(Duration.ofDays(90))));
    }
}
