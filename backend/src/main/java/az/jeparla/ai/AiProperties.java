package az.jeparla.ai;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI Studio limits (#55, PLAN 5.13), bound from {@code jeparla.ai.*}. The provider itself is
 * {@code jeparla.ai.image-provider} ({@code ImageGenerationProviders}).
 *
 * @param dailyJobsPerStore  jobs and retries one store may queue per day (Asia/Baku)
 * @param maxAttempts        attempts per job: the first run plus retries
 * @param monthlyCostLimit   hard limit of the provider cost of all stores in a calendar month, in
 *                           {@code costCurrency}; an attempt that would cross it is not started. 0 stops all jobs.
 * @param costCurrency       currency of the provider's prices (ISO 4217)
 * @param attemptTimeout     a job PROCESSING longer than this is marked FAILED (ai.timeout)
 * @param resultUrlTtl       life of the private preview URL of a result
 * @param zone               zone of the daily quota
 */
@ConfigurationProperties("jeparla.ai")
public record AiProperties(
        @DefaultValue("10") int dailyJobsPerStore,
        @DefaultValue("3") int maxAttempts,
        @DefaultValue("0") BigDecimal monthlyCostLimit,
        @DefaultValue("USD") String costCurrency,
        @DefaultValue("5m") Duration attemptTimeout,
        @DefaultValue("10m") Duration resultUrlTtl,
        @DefaultValue("Asia/Baku") ZoneId zone) {

    public AiProperties {
        if (dailyJobsPerStore < 0) {
            throw new IllegalArgumentException("jeparla.ai.daily-jobs-per-store must not be negative");
        }
        if (maxAttempts < 1 || maxAttempts > 5) {
            throw new IllegalArgumentException("jeparla.ai.max-attempts must be 1-5");
        }
        if (monthlyCostLimit == null || monthlyCostLimit.signum() < 0) {
            throw new IllegalArgumentException("jeparla.ai.monthly-cost-limit must not be negative");
        }
        if (costCurrency == null || !costCurrency.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("jeparla.ai.cost-currency must be an ISO 4217 code");
        }
    }
}
