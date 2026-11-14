package az.jeparla.pricing;

import az.jeparla.pricing.MetalQuoteService.Outcome;
import az.jeparla.pricing.MetalQuoteService.StoredQuote;
import az.jeparla.pricing.cbar.CbarBulletin;
import az.jeparla.pricing.cbar.CbarClient;
import az.jeparla.product.Metal;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import net.javacrumbs.shedlock.core.ClockProvider;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * The daily metal price job (#43, #44): fetch the CBAR bulletin, store its quotes (sanity check),
 * reprice the METAL_LINKED variants of every metal from its quote in use.
 *
 * <ul>
 *   <li>Runs from cron ({@code jeparla.metal-prices.cron}, Asia/Baku), from
 *       {@code POST /internal/jobs/metal-prices} and after an admin decision; always under the
 *       ShedLock lock {@value #LOCK_NAME}, so two instances (or a cron run and a manual one) never run
 *       it at the same time. A run that finds the lock taken does nothing.</li>
 *   <li>Idempotent: the bulletin of a day is stored once, a variant is priced once per quote.</li>
 *   <li>A failed fetch keeps the last good quote and still reprices from it (e.g. after an admin
 *       override); a weekend or holiday answer is the last bulletin, already stored.</li>
 *   <li>One summary log line per run and Micrometer counters
 *       {@code jeparla.metal_prices.quotes{outcome}}, {@code jeparla.metal_prices.fetch{result}},
 *       {@code jeparla.metal_prices.repriced{result}}.</li>
 * </ul>
 */
@Service
public class MetalPriceJob {

    public static final String LOCK_NAME = "metal-prices";

    private static final Logger log = LoggerFactory.getLogger(MetalPriceJob.class);

    /** Who started a run. */
    public enum Trigger {
        SCHEDULE,
        INTERNAL,
        ADMIN
    }

    /**
     * Result of one run.
     *
     * @param requestedDate today in Asia/Baku, the bulletin asked for
     * @param bulletinDate  the date of the bulletin CBAR answered with (earlier on weekends and
     *                      holidays); null when the fetch failed or was not done
     * @param fetchError    why the bulletin was not used, or null
     * @param quotes        what happened to each metal of the bulletin
     * @param repriced      variant counts per metal
     * @param heldMetals    metals with a quote waiting for an admin (newer than the quote in use)
     */
    public record Report(Trigger trigger, LocalDate requestedDate, LocalDate bulletinDate, String fetchError,
            List<StoredQuote> quotes, Map<Metal, RepricingService.Result> repriced, RepricingService.Result total,
            List<Metal> heldMetals, long durationMillis) {
    }

    private final CbarClient cbar;
    private final MetalQuoteService quotes;
    private final RepricingService repricing;
    private final LockingTaskExecutor locks;
    private final MetalPriceProperties properties;
    private final Clock clock;
    private final MeterRegistry meters;
    private final ExchangeRateService exchangeRates;

    public MetalPriceJob(CbarClient cbar, MetalQuoteService quotes, RepricingService repricing,
            LockingTaskExecutor locks, MetalPriceProperties properties, Clock clock,
            ObjectProvider<MeterRegistry> meters, ExchangeRateService exchangeRates) {
        this.exchangeRates = exchangeRates;
        this.cbar = cbar;
        this.quotes = quotes;
        this.repricing = repricing;
        this.locks = locks;
        this.properties = properties;
        this.clock = clock;
        this.meters = meters.getIfAvailable(SimpleMeterRegistry::new);
    }

    @Scheduled(cron = "${jeparla.metal-prices.cron:0 15 10,13,17 * * *}",
            zone = "${jeparla.metal-prices.zone:Asia/Baku}")
    void scheduled() {
        if (runLocked(Trigger.SCHEDULE).isEmpty()) {
            log.info("Metal price job: another instance holds the lock, this run is skipped");
        }
    }

    /** Fetch, store and reprice under the lock; empty when another run holds it. */
    public Optional<Report> runLocked(Trigger trigger) {
        return locked(trigger, () -> run(trigger, true));
    }

    /** Reprice only (after an admin decision), under the lock; empty when another run holds it. */
    public Optional<Report> repriceLocked(Trigger trigger) {
        return locked(trigger, () -> run(trigger, false));
    }

    private Optional<Report> locked(Trigger trigger, LockingTaskExecutor.TaskWithResult<Report> task) {
        // A scheduled run keeps the lock a little longer than it needs, so a second instance that fires
        // the same cron a moment later finds it taken; manual runs release it at once.
        Duration atLeast = trigger == Trigger.SCHEDULE ? properties.lockAtLeastFor() : Duration.ZERO;
        // ShedLock's clock (UTC instants, as written to the TIMESTAMPTZ lock columns).
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME, properties.lockAtMostFor(),
                atLeast);
        try {
            TaskResult<Report> result = locks.executeWithLock(task, lock);
            return result.wasExecuted() ? Optional.ofNullable(result.getResult()) : Optional.empty();
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Metal price job failed", e);
        }
    }

    /** The work itself, without the lock. Each step is isolated: a failed fetch still reprices. */
    Report run(Trigger trigger, boolean fetch) {
        Instant started = clock.instant();
        LocalDate today = LocalDate.ofInstant(started, properties.zone());
        LocalDate bulletinDate = null;
        String fetchError = null;
        List<StoredQuote> stored = List.of();
        if (fetch) {
            try {
                CbarBulletin bulletin = cbar.fetch(today);
                bulletinDate = bulletin.date();
                stored = quotes.store(bulletin, clock.instant());
                try {
                    // Display rates (#53) never block the metal quotes.
                    exchangeRates.store(bulletin, clock.instant());
                } catch (RuntimeException e) {
                    log.warn("Metal price job: USD/EUR rates of {} not stored: {}", bulletin.date(), e.toString());
                }
                meters.counter("jeparla.metal_prices.fetch", "result", "success").increment();
                for (StoredQuote quote : stored) {
                    meters.counter("jeparla.metal_prices.quotes", "outcome", quote.outcome().name().toLowerCase())
                            .increment();
                }
            } catch (RuntimeException e) {
                fetchError = e.getMessage();
                meters.counter("jeparla.metal_prices.fetch", "result", "failure").increment();
                log.error("Metal price job: CBAR bulletin for {} not used, the last good quotes stay in use: {}",
                        today, e.getMessage(), e);
            }
        }

        Map<Metal, RepricingService.Result> repriced = new EnumMap<>(Metal.class);
        RepricingService.Result total = RepricingService.Result.EMPTY;
        for (Metal metal : Metal.values()) {
            RepricingService.Result result;
            try {
                result = repricing.reprice(metal);
            } catch (RuntimeException e) {
                log.error("Metal price job: repricing {} failed", metal, e);
                result = new RepricingService.Result(0, 0, 0, 1);
            }
            repriced.put(metal, result);
            total = total.plus(result);
        }
        meters.counter("jeparla.metal_prices.repriced", "result", "updated").increment(total.updated());
        meters.counter("jeparla.metal_prices.repriced", "result", "unchanged").increment(total.unchanged());
        meters.counter("jeparla.metal_prices.repriced", "result", "skipped").increment(total.skipped());
        meters.counter("jeparla.metal_prices.repriced", "result", "failed").increment(total.failed());

        List<Metal> held = quotes.heldMetals();
        long millis = Duration.between(started, clock.instant()).toMillis();
        Report report = new Report(trigger, today, bulletinDate, fetchError, stored, repriced, total, held, millis);
        log.info("Metal price job ({}): requested {}, bulletin {}, quotes applied={} held={} existing={}{};"
                        + " variants updated={} unchanged={} skipped={} failed={}; waiting for an admin: {}; {} ms",
                trigger, today, bulletinDate == null ? "-" : bulletinDate, count(stored, Outcome.APPLIED),
                count(stored, Outcome.HELD), count(stored, Outcome.EXISTS),
                fetchError == null ? "" : ", fetch failed", total.updated(), total.unchanged(), total.skipped(),
                total.failed(), held.isEmpty() ? "none" : held, millis);
        return report;
    }

    private static long count(List<StoredQuote> stored, Outcome outcome) {
        return stored.stream().filter(q -> q.outcome() == outcome).count();
    }
}
