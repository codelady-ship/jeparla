package az.jeparla.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.support.MetalPriceJobTest.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** The in-memory fallback stays bounded while Redis is down (#134). */
class InMemoryRateLimitCounterTests {

    private static final Instant NOW = Instant.parse("2026-11-10T08:00:00Z");

    private final MutableClock clock = new MutableClock(NOW);

    @Test
    void aFloodOfLiveKeysNeverGrowsPastTheLimit() {
        InMemoryRateLimitCounter counter = new InMemoryRateLimitCounter(clock, 100);
        for (int i = 0; i < 10_000; i++) {
            counter.hit("flood:" + i, Duration.ofHours(1));
            assertThat(counter.size()).isLessThanOrEqualTo(100);
        }
    }

    @Test
    void expiredWindowsGoFirstAndLongWindowsSurvive() {
        InMemoryRateLimitCounter counter = new InMemoryRateLimitCounter(clock, 100);
        // A login block that must survive: a long window with a count.
        for (int i = 0; i < 5; i++) {
            counter.hit("login-account-ip:victim", Duration.ofMinutes(15));
        }
        for (int i = 0; i < 60; i++) {
            counter.hit("short:" + i, Duration.ofSeconds(10));
        }
        clock.set(NOW.plusSeconds(11));
        for (int i = 0; i < 500; i++) {
            counter.hit("flood:" + i, Duration.ofMinutes(1));
        }
        assertThat(counter.size()).isLessThanOrEqualTo(100);
        // Soonest-ending windows made room; the 15-minute block is still counted.
        assertThat(counter.peek("login-account-ip:victim").count()).isEqualTo(5);
        assertThat(counter.peek("short:0")).isEqualTo(RateLimitCounter.Window.EMPTY);
    }

    @Test
    void knownKeysAreCountedWhenFull() {
        InMemoryRateLimitCounter counter = new InMemoryRateLimitCounter(clock, 10);
        for (int i = 0; i < 10; i++) {
            counter.hit("key:" + i, Duration.ofMinutes(5));
        }
        assertThat(counter.hit("key:3", Duration.ofMinutes(5)).count()).isEqualTo(2);
        assertThat(counter.size()).isEqualTo(10);
    }
}
