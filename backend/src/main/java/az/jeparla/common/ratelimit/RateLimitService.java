package az.jeparla.common.ratelimit;

import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.ratelimit.RateLimitCounter.Window;
import az.jeparla.common.ratelimit.RateLimitProperties.Limit;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Checks a request against a {@link RateLimitPolicy} and throws {@link RateLimitExceededException}
 * (429 with {@code Retry-After}) when the limit is used up.
 *
 * <p>Keys (IP address, email, phone) are hashed with SHA-256 before they reach a counter, so Redis
 * holds no personal data. When Redis fails, the in-memory counters take over for
 * {@value #REDIS_RETRY_SECONDS} seconds before Redis is tried again: a broken Redis never blocks
 * a login, and every check stays fast.
 */
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);
    static final long REDIS_RETRY_SECONDS = 30;

    private final RateLimitProperties properties;
    private final RateLimitCounter primary;
    private final RateLimitCounter fallback;
    private final Clock clock;
    private volatile Instant primaryRetryAt = Instant.MIN;

    /**
     * @param primary  Redis counter, or null to use only {@code fallback}
     * @param fallback in-memory counter
     */
    public RateLimitService(RateLimitProperties properties, RateLimitCounter primary, RateLimitCounter fallback,
            Clock clock) {
        this.properties = properties;
        this.primary = primary;
        this.fallback = fallback;
        this.clock = clock;
    }

    /**
     * Counts one request for {@code key} under {@code policy}.
     *
     * @throws RateLimitExceededException when this request is over the limit
     */
    public void check(RateLimitPolicy policy, String key) {
        Limit limit = properties.limitOf(policy);
        Window window = use(counter -> counter.hit(counterKey(policy, key), limit.window()));
        if (window.count() > limit.limit()) {
            log.info("Rate limit {} exceeded", policy.id());
            throw new RateLimitExceededException(ceilSeconds(window.resetIn()));
        }
    }

    /**
     * Counts one event (e.g. a failed login) for {@code key} without refusing anything. Pair with
     * {@link #blockedFor} or {@link #requireUnder}, which check the count before the next attempt.
     */
    public void count(RateLimitPolicy policy, String key) {
        Limit limit = properties.limitOf(policy);
        use(counter -> counter.hit(counterKey(policy, key), limit.window()));
    }

    /**
     * Seconds until {@code key} is allowed again under {@code policy}, or 0 when the limit is not
     * used up. Counts nothing.
     */
    public long blockedFor(RateLimitPolicy policy, String key) {
        Limit limit = properties.limitOf(policy);
        Window window = use(counter -> counter.peek(counterKey(policy, key)));
        return window.count() >= limit.limit() ? ceilSeconds(window.resetIn()) : 0;
    }

    /**
     * Refuses when {@link #count} has used up the limit of {@code key}. Counts nothing.
     *
     * @throws RateLimitExceededException when the limit is used up
     */
    public void requireUnder(RateLimitPolicy policy, String key) {
        long seconds = blockedFor(policy, key);
        if (seconds > 0) {
            log.info("Rate limit {} exceeded", policy.id());
            throw new RateLimitExceededException(seconds);
        }
    }

    /** Whether {@code key} was counted in the current window of {@code policy}. */
    public boolean isCounted(RateLimitPolicy policy, String key) {
        return use(counter -> counter.peek(counterKey(policy, key))).count() > 0;
    }

    /** Clears the counter of {@code key}, e.g. after a successful login. */
    public void reset(RateLimitPolicy policy, String key) {
        use(counter -> {
            counter.reset(counterKey(policy, key));
            return null;
        });
    }

    private static String counterKey(RateLimitPolicy policy, String key) {
        return policy.id() + ":" + digest(key);
    }

    /** Runs {@code action} on Redis, or on the in-memory counters while Redis is unavailable. */
    private <T> T use(Function<RateLimitCounter, T> action) {
        if (primary != null && !clock.instant().isBefore(primaryRetryAt)) {
            try {
                return action.apply(primary);
            } catch (RuntimeException e) {
                primaryRetryAt = clock.instant().plusSeconds(REDIS_RETRY_SECONDS);
                log.warn("Rate-limit store unavailable, using in-memory counters for {}s: {}",
                        REDIS_RETRY_SECONDS, e.getClass().getSimpleName());
            }
        }
        return action.apply(fallback);
    }

    private static long ceilSeconds(Duration duration) {
        long millis = Math.max(duration.toMillis(), 0);
        return Math.max(1, (millis + 999) / 1000);
    }

    private static String digest(String key) {
        String normalized = key == null ? "" : key.strip().toLowerCase(Locale.ROOT);
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
    }
}
