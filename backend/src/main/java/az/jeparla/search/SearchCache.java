package az.jeparla.search;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * Short-lived cache of search work (#151, PLAN 5.3): the ranked ids of {@code GET /search} and the whole
 * {@code GET /search/suggest} answer, per folded query. The header box asks on every keystroke and SSR calls
 * do not pass the CDN, so the same few prefixes come again and again.
 *
 * <p>In the API's memory (Caffeine), not in Redis: one API instance (PLAN 3a), nothing to serialize, and Redis
 * holds only the rate-limit counters, which a cache must never crowd out (#134). Product cards are never cached,
 * only which products rank where: prices, stock and images on the search page are always current.
 *
 * <p>Emptied when a product, variant, store, category or synonym is saved ({@link SearchCacheEviction}, after
 * the commit); other code that changes what search finds calls {@link #evictAll()}. A query that ran while
 * such a change committed may keep its old result until {@code ttl} ends.
 */
@Component
public class SearchCache {

    private final Cache<Object, Object> cache;
    private final AtomicLong evictions = new AtomicLong();

    public SearchCache(SearchCacheProperties properties) {
        this.cache = properties.enabled()
                ? Caffeine.newBuilder()
                        .expireAfterWrite(properties.ttl())
                        .maximumSize(properties.maxEntries())
                        .build()
                : null;
    }

    /** The cached value of {@code key}, or {@code loader}'s (stored when the cache is on). Never null. */
    @SuppressWarnings("unchecked")
    <T> T get(Object key, Supplier<T> loader) {
        if (cache == null) {
            return loader.get();
        }
        return (T) cache.get(key, k -> loader.get());
    }

    /** Forgets every cached result: the catalog or the synonyms changed. */
    public void evictAll() {
        evictions.incrementAndGet();
        if (cache != null) {
            cache.invalidateAll();
        }
    }

    /** How often {@link #evictAll()} ran, also with the cache off (tests). */
    public long evictions() {
        return evictions.get();
    }
}
