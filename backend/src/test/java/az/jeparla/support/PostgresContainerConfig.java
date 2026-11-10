package az.jeparla.support;

import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * PostgreSQL 16 in a container with the two production roles (#165, {@code db/test-roles.sql}): Flyway migrates
 * as the owner {@link #MIGRATION_USER}, the application (and every test's {@code JdbcTemplate}) connects as the
 * least-privilege runtime role {@link #RUNTIME_USER}, as in production. Use it through {@link WithPostgres}.
 */
@TestConfiguration(proxyBeanMethods = false)
public class PostgresContainerConfig {

    /** Same major version and image as docker-compose.yml. */
    public static final String IMAGE = "postgres:16-alpine";

    /** Created by {@code db/test-roles.sql}; test-only passwords. */
    public static final String MIGRATION_USER = "jeparla_owner";
    public static final String MIGRATION_PASSWORD = "owner-test";
    public static final String RUNTIME_USER = "jeparla_app";
    public static final String RUNTIME_PASSWORD = "app-test";

    /** A container with the roles, for tests that run Flyway themselves. */
    public static PostgreSQLContainer container() {
        return new PostgreSQLContainer(IMAGE).withInitScript("db/test-roles.sql");
    }

    /** Flyway placeholders of the migrations (V16 grants the runtime role). */
    public static Map<String, String> placeholders() {
        return Map.of("runtimerole", RUNTIME_USER);
    }

    @Bean
    PostgreSQLContainer postgres() {
        return container();
    }

    @Bean
    DynamicPropertyRegistrar postgresProperties(PostgreSQLContainer postgres) {
        return registry -> {
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", () -> RUNTIME_USER);
            registry.add("spring.datasource.password", () -> RUNTIME_PASSWORD);
            registry.add("spring.flyway.user", () -> MIGRATION_USER);
            registry.add("spring.flyway.password", () -> MIGRATION_PASSWORD);
        };
    }

    @Bean
    DatabaseSuperuser databaseSuperuser(PostgreSQLContainer postgres) {
        return new DatabaseSuperuser(postgres);
    }
}
