package az.jeparla.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Redis 7 in a container, wired into {@code spring.data.redis.*}. Use it through {@link AuthIntegrationTest}.
 */
@TestConfiguration(proxyBeanMethods = false)
public class RedisContainerConfig {

    /** Same image as docker-compose.yml. */
    public static final String IMAGE = "redis:7.4-alpine";
    private static final int PORT = 6379;

    @Bean
    GenericContainer<?> redis() {
        return new GenericContainer<>(DockerImageName.parse(IMAGE)).withExposedPorts(PORT);
    }

    @Bean
    DynamicPropertyRegistrar redisProperties(GenericContainer<?> redis) {
        return registry -> {
            registry.add("spring.data.redis.host", redis::getHost);
            registry.add("spring.data.redis.port", () -> redis.getMappedPort(PORT));
        };
    }
}
