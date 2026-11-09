package az.jeparla.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import az.jeparla.common.error.RateLimitExceededException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class RateLimitServiceTests {

    /** A clock the test moves by hand. */
    private static final class TestClock extends Clock {

        private Instant now = Instant.parse("2026-11-09T08:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }

    private final TestClock clock = new TestClock();

    private RateLimitProperties loginIp(int limit, String window) {
        return new RateLimitProperties(RateLimitProperties.Store.MEMORY,
                Map.of("login-ip", new RateLimitProperties.Limit(limit, Duration.parse(window))));
    }

    @Test
    void allowsUpToTheLimitThenRefusesWithRetryAfter() {
        RateLimitService service = new RateLimitService(loginIp(3, "PT5M"), null, new InMemoryRateLimitCounter(clock),
                clock);
        for (int i = 0; i < 3; i++) {
            service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.1");
        }
        clock.advance(Duration.ofSeconds(61));
        RateLimitExceededException refused = catchThrowableOfType(RateLimitExceededException.class,
                () -> service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.1"));
        assertThat(refused.retryAfterSeconds()).isEqualTo(239);
        assertThat(refused.status().value()).isEqualTo(429);

        // Other keys are counted on their own.
        assertThatCode(() -> service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.2")).doesNotThrowAnyException();
        // A new window starts after the old one ends.
        clock.advance(Duration.ofMinutes(4));
        assertThatCode(() -> service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.1")).doesNotThrowAnyException();
    }

    @Test
    void keysAreCaseInsensitive() {
        RateLimitService service = new RateLimitService(loginIp(1, "PT1M"), null, new InMemoryRateLimitCounter(clock),
                clock);
        service.check(RateLimitPolicy.LOGIN_IP, "Aysel@Jeparla.test");
        assertThatExceptionOfType(RateLimitExceededException.class)
                .isThrownBy(() -> service.check(RateLimitPolicy.LOGIN_IP, " aysel@jeparla.test "));
    }

    @Test
    void policiesHaveDefaults() {
        RateLimitProperties properties = new RateLimitProperties(RateLimitProperties.Store.REDIS, null);
        assertThat(properties.limitOf(RateLimitPolicy.LOGIN_IP))
                .isEqualTo(new RateLimitProperties.Limit(20, Duration.ofMinutes(5)));
    }

    @Test
    void unknownPolicyOrZeroLimitIsAConfigurationError() {
        assertThatIllegalArgumentException().isThrownBy(() -> new RateLimitProperties(RateLimitProperties.Store.MEMORY,
                Map.of("logn-ip", new RateLimitProperties.Limit(5, null))));
        assertThatIllegalArgumentException().isThrownBy(() -> new RateLimitProperties.Limit(0, null));
    }

    @Test
    void fallsBackToMemoryWhenRedisFailsAndRetriesLater() {
        AtomicInteger redisCalls = new AtomicInteger();
        RateLimitCounter broken = (key, window) -> {
            redisCalls.incrementAndGet();
            throw new IllegalStateException("connection refused");
        };
        RateLimitService service = new RateLimitService(loginIp(2, "PT5M"), broken, new InMemoryRateLimitCounter(clock),
                clock);

        service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.1");
        service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.1");
        // Still limited while Redis is down: the in-memory counters took over.
        assertThatExceptionOfType(RateLimitExceededException.class)
                .isThrownBy(() -> service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.1"));
        // Redis was tried once, then left alone for the retry pause.
        assertThat(redisCalls).hasValue(1);

        clock.advance(Duration.ofSeconds(RateLimitService.REDIS_RETRY_SECONDS));
        service.check(RateLimitPolicy.LOGIN_IP, "10.0.0.9");
        assertThat(redisCalls).hasValue(2);
    }
}
