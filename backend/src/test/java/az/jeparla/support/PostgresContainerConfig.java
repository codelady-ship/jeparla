package az.jeparla.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * PostgreSQL 16 in a container, wired into the Spring datasource with {@code @ServiceConnection}.
 * Use it through {@link WithPostgres}.
 */
@TestConfiguration(proxyBeanMethods = false)
public class PostgresContainerConfig {

    /** Same major version and image as docker-compose.yml. */
    public static final String IMAGE = "postgres:16-alpine";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer(IMAGE);
    }
}
