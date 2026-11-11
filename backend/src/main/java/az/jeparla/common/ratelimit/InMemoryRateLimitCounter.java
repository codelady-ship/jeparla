package az.jeparla.common.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Counters in this JVM only: for tests, single-instance setups, and as the fallback while Redis is
 * unreachable. Bounded (#134): at {@value #MAX_KEYS} keys the expired windows are dropped, and if that is not
 * enough the windows that end soonest (they protect the least) make room, down to 90%. A flood of distinct
 * keys while Redis is down cannot grow the heap without limit.
 */
public class InMemoryRateLimitCounter implements RateLimitCounter {

    private static final Logger log = LoggerFactory.getLogger(InMemoryRateLimitCounter.class);

    /** About 10 MB of counters. */
    static final int MAX_KEYS = 50_000;

    private final Clock clock;
    private final int maxKeys;
    private final ConcurrentHashMap<String, Entry> windows = new ConcurrentHashMap<>();

    public InMemoryRateLimitCounter(Clock clock) {
        this(clock, MAX_KEYS);
    }

    InMemoryRateLimitCounter(Clock clock, int maxKeys) {
        if (maxKeys < 10) {
            throw new IllegalArgumentException("maxKeys must be at least 10");
        }
        this.clock = clock;
        this.maxKeys = maxKeys;
    }

    @Override
    public Window hit(String key, Duration window) {
        Instant now = clock.instant();
        if (windows.size() >= maxKeys && !windows.containsKey(key)) {
            makeRoom(now);
        }
        Entry entry = windows.compute(key, (k, current) -> current == null || !current.end().isAfter(now)
                ? new Entry(now.plus(window), 1)
                : new Entry(current.end(), current.count() + 1));
        return new Window(entry.count(), Duration.between(now, entry.end()));
    }

    @Override
    public Window peek(String key) {
        Instant now = clock.instant();
        Entry entry = windows.get(key);
        if (entry == null || !entry.end().isAfter(now)) {
            return Window.EMPTY;
        }
        return new Window(entry.count(), Duration.between(now, entry.end()));
    }

    @Override
    public void reset(String key) {
        windows.remove(key);
    }

    /** Number of windows held (tests). */
    int size() {
        return windows.size();
    }

    private synchronized void makeRoom(Instant now) {
        if (windows.size() < maxKeys) {
            return;
        }
        windows.values().removeIf(entry -> !entry.end().isAfter(now));
        int target = maxKeys - maxKeys / 10;
        int excess = windows.size() - target;
        if (excess <= 0) {
            return;
        }
        windows.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<String, Entry> e) -> e.getValue().end()))
                .limit(excess)
                .map(Map.Entry::getKey)
                .toList()
                .forEach(windows::remove);
        log.warn("In-memory rate-limit counters full: {} live window(s) dropped", excess);
    }

    private record Entry(Instant end, long count) {
    }
}
