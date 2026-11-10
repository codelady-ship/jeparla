package az.jeparla.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.MapPropertySource;
import org.springframework.test.context.ContextConfiguration;

/**
 * Metal price job tests (#43, #44) on PostgreSQL 16: CBAR is the local {@link CbarStub} (no live calls),
 * the clock is a {@link MutableClock} the test sets, the internal job token is {@link #JOB_TOKEN}. Tests
 * commit for real (the job uses its own transactions and a database lock), so each test starts from
 * empty quote, product and lock tables ({@link MetalPriceJobTestSupport#clean()}). All classes with this
 * annotation share one context and one database. Skipped without Docker, mandatory in CI.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@WithPostgres
@SpringBootTest(properties = {
        "jeparla.internal.job-token=" + MetalPriceJobTest.JOB_TOKEN,
        "jeparla.metal-prices.batch-size=2",
})
@ContextConfiguration(initializers = MetalPriceJobTest.StubInitializer.class)
@Import(MetalPriceJobTest.ClockConfig.class)
@AutoConfigureMockMvc
public @interface MetalPriceJobTest {

    /** Test-only shared secret of the internal job endpoint (32+ bytes, deliberately not random). */
    String JOB_TOKEN = "test-job-token-test-job-token-test-job";

    /** The one stub of the test JVM; its URL goes into {@code jeparla.metal-prices.source-url}. */
    CbarStub STUB = new CbarStub();

    class StubInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

        @Override
        public void initialize(ConfigurableApplicationContext context) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("cbar-stub",
                    Map.of("jeparla.metal-prices.source-url", STUB.sourceUrl())));
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    class ClockConfig {

        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(Instant.parse("2026-11-06T08:00:00Z"));
        }
    }

    /** A clock the test moves. */
    final class MutableClock extends Clock {

        private volatile Instant now;

        public MutableClock(Instant now) {
            this.now = now;
        }

        public void set(Instant now) {
            this.now = now;
        }

        /** {@code hh:mm} in Asia/Baku on {@code date}. */
        public void setBaku(String date, String time) {
            set(java.time.LocalDateTime.parse(date + "T" + time).atZone(ZoneId.of("Asia/Baku")).toInstant());
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
