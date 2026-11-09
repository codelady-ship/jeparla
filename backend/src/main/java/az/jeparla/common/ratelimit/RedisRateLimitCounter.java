package az.jeparla.common.ratelimit;

import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * Counters in Redis, shared by every API instance. One atomic script per hit: INCR, set the expiry
 * on the first hit of a window (or if it was lost), return the count and the remaining time.
 */
public class RedisRateLimitCounter implements RateLimitCounter {

    static final String KEY_PREFIX = "jeparla:rl:";

    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> SCRIPT = new DefaultRedisScript<>("""
            local count = redis.call('INCR', KEYS[1])
            local ttl = redis.call('PTTL', KEYS[1])
            if count == 1 or ttl < 0 then
              redis.call('PEXPIRE', KEYS[1], ARGV[1])
              ttl = tonumber(ARGV[1])
            end
            return {count, ttl}
            """, List.class);

    /** Count and remaining time of a window without counting a hit; {0, 0} when there is none. */
    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> PEEK = new DefaultRedisScript<>("""
            local count = redis.call('GET', KEYS[1])
            if not count then
              return {0, 0}
            end
            return {tonumber(count), redis.call('PTTL', KEYS[1])}
            """, List.class);

    private final StringRedisTemplate redis;

    public RedisRateLimitCounter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public Window hit(String key, Duration window) {
        return window(redis.execute(SCRIPT, List.of(KEY_PREFIX + key), String.valueOf(window.toMillis())));
    }

    @Override
    public Window peek(String key) {
        Window window = window(redis.execute(PEEK, List.of(KEY_PREFIX + key)));
        return window.count() == 0 ? Window.EMPTY : window;
    }

    @Override
    public void reset(String key) {
        redis.delete(KEY_PREFIX + key);
    }

    private static Window window(List<?> result) {
        if (result == null || result.size() != 2) {
            throw new IllegalStateException("Unexpected rate-limit script result");
        }
        long count = ((Number) result.get(0)).longValue();
        long ttlMillis = ((Number) result.get(1)).longValue();
        return new Window(count, Duration.ofMillis(Math.max(ttlMillis, 0)));
    }
}
