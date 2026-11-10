package az.jeparla.common.config;

import javax.sql.DataSource;
import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables {@code @Scheduled} jobs. Every job must be idempotent, and a job that must not run on two
 * instances at once takes a ShedLock lock (table {@code shedlock}, V11) through
 * {@link LockingTaskExecutor}. Lock times are UTC instants from the JVM clock (TIMESTAMPTZ columns);
 * the scheduled run's lock-at-least-for covers small clock differences between instances.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
public class SchedulingConfig {

    @Bean
    LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .withTableName("shedlock")
                // Not usingDbTime(): on PostgreSQL it writes timezone('utc', now()), a timestamp without
                // time zone, into the TIMESTAMPTZ columns, which shifts the lock by the session offset.
                .build());
    }

    @Bean
    LockingTaskExecutor lockingTaskExecutor(LockProvider lockProvider) {
        return new DefaultLockingTaskExecutor(lockProvider);
    }
}
