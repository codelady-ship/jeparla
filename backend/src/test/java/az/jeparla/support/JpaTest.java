package az.jeparla.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Repository and entity tests: the full application on PostgreSQL 16 (Flyway + Hibernate
 * {@code validate}), Hibernate statistics on (statement counts for the N+1 tests), and every
 * test in a transaction that is rolled back. All classes with this annotation share one
 * application context and one container.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@WithPostgres
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Transactional
public @interface JpaTest {
}
