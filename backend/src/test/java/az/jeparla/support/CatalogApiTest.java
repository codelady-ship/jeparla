package az.jeparla.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public catalog API tests over HTTP (MockMvc) on PostgreSQL 16 with the {@code demo} seed (the same
 * catalog as frontend/src/lib/api/mock/fixtures.ts). Every test runs in a transaction that is rolled
 * back, so extra products created with {@link TestData} never leak into other tests; MockMvc runs the
 * request on the test thread, inside that transaction. Hibernate statistics are on for the statement
 * counts, and the rate limits of the two public POSTs are small. All classes with this annotation
 * share one application context and one database. Skipped without Docker, mandatory in CI.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@WithPostgres
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "jeparla.rate-limit.policies.report-ip.limit=" + CatalogApiTest.REPORT_IP_LIMIT,
        "jeparla.rate-limit.policies.contact-ip.limit=" + CatalogApiTest.CONTACT_IP_LIMIT,
        "jeparla.rate-limit.policies.search-ip.limit=" + CatalogApiTest.SEARCH_IP_LIMIT,
})
@ActiveProfiles("demo")
@AutoConfigureMockMvc
@Transactional
public @interface CatalogApiTest {

    int REPORT_IP_LIMIT = 3;
    int CONTACT_IP_LIMIT = 3;
    /** High enough for every search request of the shared context from 127.0.0.1 within a minute. */
    int SEARCH_IP_LIMIT = 2000;
}
