package az.jeparla.common.ratelimit;

import java.time.Duration;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Rate-limit settings bound from {@code jeparla.rate-limit.*}.
 *
 * @param store    where counters live: {@code redis} (production; shared by every instance and kept
 *                 across restarts) or {@code memory} (one JVM only). With {@code redis}, the
 *                 in-memory counters take over while Redis is unreachable, so the API keeps working.
 * @param policies overrides of the {@link RateLimitPolicy} defaults, keyed by policy id
 */
@ConfigurationProperties("jeparla.rate-limit")
public record RateLimitProperties(
        @DefaultValue("redis") Store store,
        Map<String, Limit> policies) {

    public RateLimitProperties {
        policies = policies == null ? Map.of() : Map.copyOf(policies);
        for (String id : policies.keySet()) {
            boolean known = false;
            for (RateLimitPolicy policy : RateLimitPolicy.values()) {
                known |= policy.id().equals(id);
            }
            if (!known) {
                throw new IllegalArgumentException("Unknown rate-limit policy: jeparla.rate-limit.policies." + id);
            }
        }
    }

    /** Effective limit of a policy: the configured one, else the default. */
    public Limit limitOf(RateLimitPolicy policy) {
        Limit configured = policies.get(policy.id());
        int limit = configured != null && configured.limit() != null ? configured.limit() : policy.defaultLimit();
        Duration window = configured != null && configured.window() != null ? configured.window() : policy.defaultWindow();
        return new Limit(limit, window);
    }

    public enum Store {
        REDIS,
        MEMORY
    }

    /**
     * @param limit  requests allowed per window
     * @param window fixed window length
     */
    public record Limit(Integer limit, Duration window) {

        public Limit {
            if (limit != null && limit < 1) {
                throw new IllegalArgumentException("Rate limit must be at least 1");
            }
            if (window != null && (window.isNegative() || window.toMillis() < 1000)) {
                throw new IllegalArgumentException("Rate-limit window must be at least 1s");
            }
        }
    }
}
