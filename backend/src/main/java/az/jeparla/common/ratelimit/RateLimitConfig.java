package az.jeparla.common.ratelimit;

import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration(proxyBeanMethods = false)
public class RateLimitConfig {

    @Bean
    RateLimitService rateLimitService(RateLimitProperties properties, ObjectProvider<StringRedisTemplate> redis,
            Clock clock) {
        RateLimitCounter primary = null;
        if (properties.store() == RateLimitProperties.Store.REDIS) {
            StringRedisTemplate template = redis.getIfAvailable();
            if (template == null) {
                throw new IllegalStateException("jeparla.rate-limit.store=redis needs Spring Data Redis");
            }
            primary = new RedisRateLimitCounter(template);
        }
        return new RateLimitService(properties, primary, new InMemoryRateLimitCounter(clock), clock);
    }
}
