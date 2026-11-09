package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.ratelimit.InMemoryRateLimitCounter;
import az.jeparla.common.ratelimit.RateLimitProperties;
import az.jeparla.common.ratelimit.RateLimitProperties.Limit;
import az.jeparla.common.ratelimit.RateLimitService;
import java.time.Clock;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The login limits without HTTP (#133); {@code RateLimitTests} covers them end to end in Redis. */
class LoginThrottleTests {

    private static final int PER_IP = 100;
    private static final int PER_ACCOUNT_IP = 3;
    private static final int PER_ACCOUNT = 8;
    private static final String OWNER = "+994501234567";

    private final LoginThrottle throttle = new LoginThrottle(new RateLimitService(
            new RateLimitProperties(RateLimitProperties.Store.MEMORY, Map.of(
                    "login-ip", new Limit(PER_IP, null),
                    "login-account-ip", new Limit(PER_ACCOUNT_IP, null),
                    "login-account", new Limit(PER_ACCOUNT, null))),
            null, new InMemoryRateLimitCounter(Clock.systemUTC()), Clock.systemUTC()));

    @Test
    void attemptsWithoutAFailedPasswordNeverLockTheAccount() {
        // The old limit counted every request, so these alone locked the owner out.
        for (int i = 0; i < 50; i++) {
            throttle.beforeAttempt(OWNER, "198.51.100." + (i % 5));
        }
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
    }

    @Test
    void failuresFromOtherAddressesDoNotBlockTheOwner() {
        for (int i = 0; i < PER_ACCOUNT - 1; i++) {
            String attacker = "198.51.100." + i;
            throttle.beforeAttempt(OWNER, attacker);
            throttle.failed(OWNER, attacker);
        }
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
    }

    @Test
    void repeatedFailuresFromOneAddressBlockThatAddressOnly() {
        for (int i = 0; i < PER_ACCOUNT_IP; i++) {
            throttle.beforeAttempt(OWNER, "198.51.100.7");
            throttle.failed(OWNER, "198.51.100.7");
        }
        assertThatExceptionOfType(RateLimitExceededException.class)
                .isThrownBy(() -> throttle.beforeAttempt(OWNER, "198.51.100.7"));
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
        // Another account from the same address is not affected.
        assertThatCode(() -> throttle.beforeAttempt("+994507654321", "198.51.100.7")).doesNotThrowAnyException();
    }

    @Test
    void successClearsTheFailuresOfThatAddress() {
        for (int i = 0; i < PER_ACCOUNT_IP - 1; i++) {
            throttle.failed(OWNER, "203.0.113.1");
        }
        throttle.succeeded(OWNER, "203.0.113.1");
        for (int i = 0; i < PER_ACCOUNT_IP - 1; i++) {
            throttle.failed(OWNER, "203.0.113.1");
        }
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
    }

    @Test
    void underADistributedAttackOnlyKnownAddressesSignIn() {
        throttle.beforeAttempt(OWNER, "203.0.113.1");
        throttle.succeeded(OWNER, "203.0.113.1");

        for (int i = 0; i < PER_ACCOUNT * 2; i++) {
            throttle.failed(OWNER, "198.51.100." + i);
        }

        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
        assertThatExceptionOfType(RateLimitExceededException.class)
                .isThrownBy(() -> throttle.beforeAttempt(OWNER, "198.51.100.200"));
    }
}
