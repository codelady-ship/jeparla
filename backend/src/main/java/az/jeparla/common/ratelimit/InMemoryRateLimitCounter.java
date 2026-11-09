package az.jeparla.common.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Counters in this JVM only: for tests, single-instance setups, and as the fallback while Redis is
 * unreachable. Bounded: expired windows are dropped when the map grows.
 */
public class InMemoryRateLimitCounter implements RateLimitCounter {

    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Clock clock;
    private final ConcurrentHashMap<String, Entry> windows = new ConcurrentHashMap<>();

    public InMemoryRateLimitCounter(Clock clock) {
        this.clock = clock;
    }

    @Override
    public Window hit(String key, Duration window) {
        Instant now = clock.instant();
        if (windows.size() > CLEANUP_THRESHOLD) {
            windows.values().removeIf(entry -> !entry.end().isAfter(now));
        }
        Entry entry = windows.compute(key, (k, current) -> current == null || !current.end().isAfter(now)
                ? new Entry(now.plus(window), 1)
                : new Entry(current.end(), current.count() + 1));
        return new Window(entry.count(), Duration.between(now, entry.end()));
    }

    private record Entry(Instant end, long count) {
    }
}
