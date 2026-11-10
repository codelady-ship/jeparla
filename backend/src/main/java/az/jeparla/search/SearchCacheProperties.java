package az.jeparla.search;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Search cache settings bound from {@code jeparla.search.cache.*} (#151).
 *
 * @param ttl        how long a ranking or a suggestion list is reused; zero turns the cache off
 * @param maxEntries queries kept at most (least recently used go first)
 */
@ConfigurationProperties("jeparla.search.cache")
public record SearchCacheProperties(
        @DefaultValue("60s") Duration ttl,
        @DefaultValue("5000") int maxEntries) {

    public SearchCacheProperties {
        if (ttl == null || ttl.isNegative()) {
            throw new IllegalArgumentException("jeparla.search.cache.ttl must be zero or positive");
        }
        if (ttl.compareTo(Duration.ofMinutes(10)) > 0) {
            throw new IllegalArgumentException("jeparla.search.cache.ttl must be at most 10m: results go stale");
        }
        if (maxEntries < 1) {
            throw new IllegalArgumentException("jeparla.search.cache.max-entries must be positive");
        }
    }

    boolean enabled() {
        return !ttl.isZero();
    }
}
