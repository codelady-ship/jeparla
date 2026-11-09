package az.jeparla.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.context.annotation.Import;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * For {@code @SpringBootTest} classes: the application context gets a real PostgreSQL 16
 * (Testcontainers) and Flyway migrates it at startup.
 *
 * <p>On a machine without Docker the class is skipped, not failed. CI (GitHub ubuntu runners)
 * has Docker, so the tests always run there; the Gradle log lists each test as PASSED or SKIPPED.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Testcontainers(disabledWithoutDocker = true)
@Import(PostgresContainerConfig.class)
public @interface WithPostgres {
}
