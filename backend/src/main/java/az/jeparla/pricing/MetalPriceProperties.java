package az.jeparla.pricing;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Daily metal price job settings, bound from {@code jeparla.metal-prices.*} (#43, #44).
 *
 * @param sourceUrl             CBAR daily bulletin; {@code {date}} becomes {@code dd.MM.yyyy}
 * @param userAgent             sent with every CBAR request: names the product, no personal contact
 * @param zone                  business time zone: "today" for the bulletin, and the cron zone
 * @param cron                  when the job runs (Spring cron, in {@code zone}); {@code -} turns it off
 * @param connectTimeout        TCP + TLS connect timeout
 * @param readTimeout           whole response timeout of one attempt
 * @param attempts              tries per run (1 = no retry); only network errors and 5xx/429 are retried
 * @param backoff               wait before the second try, doubled for each further one
 * @param maxDailyChangePercent a CBAR quote that moved more than this (percent, one decimal, as the
 *                              admin panel shows it) is HELD for an admin instead of applied (PLAN 5.10)
 * @param batchSize             variants repriced per transaction
 * @param lockAtMostFor         the run lock is released after this even if the instance dies
 * @param lockAtLeastFor        a scheduled run keeps the lock this long, so another instance whose
 *                              clock is a little behind does not start the same run again
 */
@ConfigurationProperties("jeparla.metal-prices")
public record MetalPriceProperties(
        @DefaultValue("https://www.cbar.az/currencies/{date}.xml") String sourceUrl,
        @DefaultValue("Jeparla/1.0 (metal price service; +https://jeparla.az)") String userAgent,
        @DefaultValue("Asia/Baku") ZoneId zone,
        @DefaultValue("0 15 10,13,17 * * *") String cron,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("20s") Duration readTimeout,
        @DefaultValue("3") int attempts,
        @DefaultValue("30s") Duration backoff,
        @DefaultValue("10") BigDecimal maxDailyChangePercent,
        @DefaultValue("200") int batchSize,
        @DefaultValue("30m") Duration lockAtMostFor,
        @DefaultValue("1m") Duration lockAtLeastFor) {

    public MetalPriceProperties {
        if (sourceUrl == null || !sourceUrl.contains("{date}")
                || !(sourceUrl.startsWith("https://") || sourceUrl.startsWith("http://"))) {
            throw new IllegalArgumentException("jeparla.metal-prices.source-url must be an http(s) URL with {date}");
        }
        if (attempts < 1 || attempts > 10) {
            throw new IllegalArgumentException("jeparla.metal-prices.attempts must be 1..10");
        }
        if (batchSize < 1 || batchSize > 1000) {
            throw new IllegalArgumentException("jeparla.metal-prices.batch-size must be 1..1000");
        }
        if (maxDailyChangePercent.signum() <= 0) {
            throw new IllegalArgumentException("jeparla.metal-prices.max-daily-change-percent must be positive");
        }
        if (lockAtLeastFor.compareTo(lockAtMostFor) > 0) {
            throw new IllegalArgumentException("jeparla.metal-prices.lock-at-least-for must not exceed lock-at-most-for");
        }
    }
}
