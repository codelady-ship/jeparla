package az.jeparla.pricing;

import az.jeparla.product.Metal;
import az.jeparla.product.ProductVariant;
import az.jeparla.product.ProductVariantRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Reprices the live METAL_LINKED variants of a metal from the quote in use (#44). FIXED variants are
 * never touched.
 *
 * <ul>
 *   <li>Idempotent: a variant already priced from that quote is skipped, so a second run changes
 *       nothing and writes no second history row (the unique index on {@code price_history
 *       (variant_id, metal_snapshot_id)} is the last guard).</li>
 *   <li>A changed price writes a {@code price_history} row (reason METAL_PRICE, the quote, the previous
 *       price); an unchanged one only moves the variant to the new quote and its "price updated" time.</li>
 *   <li>Batches of {@code batch-size} variants per transaction. A variant whose price cannot be computed
 *       is counted as failed and keeps its last price; if a batch fails in the database, its variants
 *       are retried one per transaction, so one bad row never blocks the others.</li>
 * </ul>
 */
@Service
public class RepricingService {

    private static final Logger log = LoggerFactory.getLogger(RepricingService.class);

    /** Counts of one repricing run. */
    public record Result(int updated, int unchanged, int skipped, int failed) {

        public static final Result EMPTY = new Result(0, 0, 0, 0);

        public Result plus(Result other) {
            return new Result(updated + other.updated, unchanged + other.unchanged, skipped + other.skipped,
                    failed + other.failed);
        }

        public int total() {
            return updated + unchanged + skipped + failed;
        }
    }

    private enum VariantOutcome {
        UPDATED,
        UNCHANGED,
        SKIPPED,
        FAILED
    }

    private final ProductVariantRepository variants;
    private final MetalPriceSnapshotRepository snapshots;
    private final PriceHistoryRepository history;
    private final TransactionTemplate transactions;
    private final MetalPriceProperties properties;
    private final Clock clock;

    public RepricingService(ProductVariantRepository variants, MetalPriceSnapshotRepository snapshots,
            PriceHistoryRepository history, PlatformTransactionManager transactionManager,
            MetalPriceProperties properties, Clock clock) {
        this.variants = variants;
        this.snapshots = snapshots;
        this.history = history;
        this.transactions = new TransactionTemplate(transactionManager);
        this.properties = properties;
        this.clock = clock;
    }

    /** Reprices the metal from its quote in use; nothing when the metal has no applied quote yet. */
    public Result reprice(Metal metal) {
        Optional<MetalPriceSnapshot> inUse = snapshots.findFirstByMetalAndStatusOrderByQuoteDateDescIdDesc(metal,
                QuoteStatus.APPLIED);
        if (inUse.isEmpty()) {
            return Result.EMPTY;
        }
        Long snapshotId = inUse.get().getId();
        List<Long> ids = variants.findLiveMetalLinkedIds(metal);
        Result result = Result.EMPTY;
        for (int from = 0; from < ids.size(); from += properties.batchSize()) {
            List<Long> batch = ids.subList(from, Math.min(from + properties.batchSize(), ids.size()));
            result = result.plus(repriceBatch(batch, snapshotId));
        }
        return result;
    }

    private Result repriceBatch(List<Long> batch, Long snapshotId) {
        try {
            return Objects.requireNonNull(transactions.execute(status -> {
                MetalPriceSnapshot snapshot = snapshots.getReferenceById(snapshotId);
                Instant now = clock.instant();
                Result result = Result.EMPTY;
                for (ProductVariant variant : variants.findWithFinenessByIdIn(batch)) {
                    result = result.plus(count(repriceOne(variant, snapshot, now)));
                }
                return result;
            }));
        } catch (RuntimeException e) {
            log.warn("Repricing batch of {} variants (ids {}..{}) failed in the database ({}); retrying one by one",
                    batch.size(), batch.getFirst(), batch.getLast(), e.toString());
            Result result = Result.EMPTY;
            for (Long id : batch) {
                result = result.plus(repriceAlone(id, snapshotId));
            }
            return result;
        }
    }

    private Result repriceAlone(Long variantId, Long snapshotId) {
        try {
            return Objects.requireNonNull(transactions.execute(status -> {
                MetalPriceSnapshot snapshot = snapshots.getReferenceById(snapshotId);
                return variants.findWithFinenessByIdIn(List.of(variantId)).stream()
                        .map(variant -> count(repriceOne(variant, snapshot, clock.instant())))
                        .reduce(Result.EMPTY, Result::plus);
            }));
        } catch (RuntimeException e) {
            log.error("Repricing variant {} from quote {} failed; it keeps its last price", variantId, snapshotId, e);
            return count(VariantOutcome.FAILED);
        }
    }

    private VariantOutcome repriceOne(ProductVariant variant, MetalPriceSnapshot snapshot, Instant now) {
        MetalPriceSnapshot current = variant.getMetalSnapshot();
        if (current != null && Objects.equals(current.getId(), snapshot.getId())) {
            return VariantOutcome.SKIPPED;
        }
        BigDecimal price;
        try {
            if (!variant.getCurrency().equals(snapshot.getCurrency())) {
                throw new IllegalStateException("variant currency " + variant.getCurrency()
                        + " differs from the quote currency " + snapshot.getCurrency());
            }
            price = PricingEngine.price(variant.getWeightGrams(), variant.getFineness().getValue(),
                    snapshot.getPricePerGram(), ruleOf(variant));
        } catch (RuntimeException e) {
            log.error("Variant {} ({}) cannot be priced from quote {}: {}; it keeps its last price", variant.getId(),
                    variant.getSku(), snapshot.getId(), e.getMessage());
            return VariantOutcome.FAILED;
        }
        BigDecimal previous = variant.getPrice();
        boolean changed = previous.compareTo(price) != 0;
        if (changed) {
            history.save(new PriceHistory(variant, price, previous, variant.getCurrency(), PriceChangeReason.METAL_PRICE,
                    snapshot, null));
        }
        variant.applyMetalPrice(price, snapshot, now);
        return changed ? VariantOutcome.UPDATED : VariantOutcome.UNCHANGED;
    }

    static PricingEngine.Rule ruleOf(ProductVariant variant) {
        return new PricingEngine.Rule(variant.getLaborPerGram(), variant.getLaborFixed(), variant.getStonePrice(),
                variant.getMarkupPercent(), variant.getMinPrice(), variant.getMaxPrice());
    }

    private static Result count(VariantOutcome outcome) {
        return switch (outcome) {
            case UPDATED -> new Result(1, 0, 0, 0);
            case UNCHANGED -> new Result(0, 1, 0, 0);
            case SKIPPED -> new Result(0, 0, 1, 0);
            case FAILED -> new Result(0, 0, 0, 1);
        };
    }
}
