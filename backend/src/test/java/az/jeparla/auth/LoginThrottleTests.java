package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.ratelimit.InMemoryRateLimitCounter;
import az.jeparla.common.ratelimit.RateLimitProperties;
import az.jeparla.common.ratelimit.RateLimitProperties.Limit;
import az.jeparla.common.ratelimit.RateLimitService;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/** The login limits without HTTP (#133, #134); {@code RateLimitTests} covers them end to end in Redis. */
class LoginThrottleTests {

    private static final int PER_IP = 100;
    private static final int PER_ACCOUNT_IP = 3;
    private static final int PER_ACCOUNT = 8;
    private static final String OWNER = "+994501234567";

    private final LoginThrottle throttle = throttle(PER_IP, PER_ACCOUNT_IP);

    private static LoginThrottle throttle(int perIp, int perAccountIp) {
        return new LoginThrottle(new RateLimitService(
                new RateLimitProperties(RateLimitProperties.Store.MEMORY, Map.of(
                        "login-ip", new Limit(perIp, null),
                        "login-account-ip", new Limit(perAccountIp, null),
                        "login-account", new Limit(PER_ACCOUNT, null))),
                null, new InMemoryRateLimitCounter(Clock.systemUTC()), Clock.systemUTC()));
    }

    /** One login request as AuthController runs it; true when it reached the password check. */
    private boolean wrongPassword(LoginThrottle throttle, String account, String address) {
        try {
            throttle.beforeAttempt(account, address);
        } catch (RateLimitExceededException e) {
            return false;
        }
        throttle.failed(account, address);
        return true;
    }

    @Test
    void successfulSignInsNeverLockTheAccount() {
        // The old limit counted every request, so these alone locked the owner out.
        for (int i = 0; i < 50; i++) {
            String address = "198.51.100." + (i % 5);
            throttle.beforeAttempt(OWNER, address);
            throttle.succeeded(OWNER, address);
        }
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
    }

    @Test
    void failuresFromOtherAddressesDoNotBlockTheOwner() {
        for (int i = 0; i < PER_ACCOUNT - 1; i++) {
            assertThat(wrongPassword(throttle, OWNER, "198.51.100." + i)).isTrue();
        }
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
    }

    @Test
    void repeatedFailuresFromOneAddressBlockThatAddressOnly() {
        for (int i = 0; i < PER_ACCOUNT_IP; i++) {
            assertThat(wrongPassword(throttle, OWNER, "198.51.100.7")).isTrue();
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
            wrongPassword(throttle, OWNER, "203.0.113.1");
        }
        throttle.beforeAttempt(OWNER, "203.0.113.1");
        throttle.succeeded(OWNER, "203.0.113.1");
        for (int i = 0; i < PER_ACCOUNT_IP - 1; i++) {
            assertThat(wrongPassword(throttle, OWNER, "203.0.113.1")).isTrue();
        }
        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
    }

    @Test
    void underADistributedAttackOnlyKnownAddressesSignIn() {
        throttle.beforeAttempt(OWNER, "203.0.113.1");
        throttle.succeeded(OWNER, "203.0.113.1");

        for (int i = 0; i < PER_ACCOUNT * 2; i++) {
            wrongPassword(throttle, OWNER, "198.51.100." + i);
        }

        assertThatCode(() -> throttle.beforeAttempt(OWNER, "203.0.113.1")).doesNotThrowAnyException();
        assertThatExceptionOfType(RateLimitExceededException.class)
                .isThrownBy(() -> throttle.beforeAttempt(OWNER, "198.51.100.200"));
    }

    /**
     * Review of #135 (#134): the pair limit used to be read before the password check and counted after it, so
     * parallel requests from one address all passed the check. Now each takes its place first.
     */
    @Test
    void parallelWrongPasswordsFromOneAddressReachThePasswordCheckAtMostLimitTimes() throws Exception {
        int perAccountIp = 5;
        LoginThrottle limited = throttle(20, perAccountIp);
        int requests = 20;
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        try {
            CountDownLatch start = new CountDownLatch(1);
            AtomicInteger checked = new AtomicInteger();
            List<Future<?>> done = new ArrayList<>();
            for (int i = 0; i < requests; i++) {
                done.add(pool.submit(() -> {
                    start.await();
                    if (wrongPassword(limited, OWNER, "198.51.100.9")) {
                        checked.incrementAndGet();
                    }
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> future : done) {
                future.get(10, TimeUnit.SECONDS);
            }
            assertThat(checked.get()).isEqualTo(perAccountIp);
        } finally {
            pool.shutdownNow();
        }
    }
}
