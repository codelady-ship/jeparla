package az.jeparla.pricing;

import az.jeparla.pricing.cbar.CbarBulletin;
import com.fasterxml.jackson.annotation.JsonFormat;
import az.jeparla.product.Metal;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stores the quotes of a CBAR bulletin (#43): one snapshot per metal and business day, idempotent, with
 * the sanity check of PLAN 5.10. A quote that moved more than the limit against the price in use is
 * stored HELD: it prices nothing until an admin accepts it, and the last good quote stays in use.
 */
@Service
public class MetalQuoteService {

    private static final Logger log = LoggerFactory.getLogger(MetalQuoteService.class);

    /** What happened to one metal of a bulletin. */
    public enum Outcome {
        /** New quote, now in use. */
        APPLIED,
        /** New quote, moved more than the limit: waits for an admin. */
        HELD,
        /** The bulletin of that day was stored before (weekend, second run of the day). */
        EXISTS
    }

    /**
     * @param changePercent against the price in use, one decimal; null for the first quote of a metal
     *                      or an existing one
     */
    public record StoredQuote(Metal metal, LocalDate date, Outcome outcome,
            @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal pricePerOunce,
            @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal changePercent) {
    }

    private final MetalPriceSnapshotRepository snapshots;
    private final MetalPriceProperties properties;

    public MetalQuoteService(MetalPriceSnapshotRepository snapshots, MetalPriceProperties properties) {
        this.snapshots = snapshots;
        this.properties = properties;
    }

    @Transactional
    public List<StoredQuote> store(CbarBulletin bulletin, Instant fetchedAt) {
        List<StoredQuote> stored = new ArrayList<>();
        for (Metal metal : Metal.values()) {
            BigDecimal ounce = bulletin.ouncePrices().get(metal);
            LocalDate date = bulletin.date();
            if (snapshots.findByMetalAndQuoteDateAndSource(metal, date, QuoteSource.CBAR).isPresent()) {
                stored.add(new StoredQuote(metal, date, Outcome.EXISTS, ounce, null));
                continue;
            }
            MetalPriceSnapshot snapshot = new MetalPriceSnapshot(metal, date, ounce, PricingEngine.gramPrice(ounce),
                    QuoteSource.CBAR, fetchedAt);
            Optional<MetalPriceSnapshot> inUse = inUse(metal);
            BigDecimal change = inUse.map(q -> PricingEngine.percentChange(q.getPricePerOunce(), ounce)).orElse(null);
            Outcome outcome = Outcome.APPLIED;
            if (change != null && isLargeChange(change)) {
                snapshot.hold(storable(change));
                outcome = Outcome.HELD;
                // Admin alert: the stale-price check (.github/workflows/metal-prices-check.yml) opens an
                // issue while a quote is held, and the admin panel shows it.
                log.warn("METAL PRICE HELD: CBAR {} {} {} AZN/oz is {}% against the price in use {} AZN/oz of {};"
                                + " not applied, waits for an admin (limit {}%)", metal, date, ounce, change,
                        inUse.get().getPricePerOunce(), inUse.get().getQuoteDate(), properties.maxDailyChangePercent());
            } else if (change != null) {
                snapshot.setChangePercent(change);
            }
            snapshots.save(snapshot);
            stored.add(new StoredQuote(metal, date, outcome, ounce, change));
        }
        return stored;
    }

    /** The quote in use: the newest APPLIED one. */
    @Transactional(readOnly = true)
    public Optional<MetalPriceSnapshot> inUse(Metal metal) {
        return snapshots.findFirstByMetalAndStatusOrderByQuoteDateDescIdDesc(metal, QuoteStatus.APPLIED);
    }

    /**
     * The newest HELD quote, if it is newer than the quote in use: it waits for an admin. An older held
     * quote is out of date (a later quote was applied or overridden) and needs nobody.
     */
    @Transactional(readOnly = true)
    public Optional<MetalPriceSnapshot> pendingHeld(Metal metal) {
        Optional<MetalPriceSnapshot> held = snapshots.findFirstByMetalAndStatusOrderByQuoteDateDescIdDesc(metal,
                QuoteStatus.HELD);
        Optional<MetalPriceSnapshot> inUse = inUse(metal);
        return held.filter(h -> inUse.isEmpty() || h.getQuoteDate().isAfter(inUse.get().getQuoteDate())
                || h.getQuoteDate().isEqual(inUse.get().getQuoteDate()) && h.getId() > inUse.get().getId());
    }

    /** Metals with a quote waiting for an admin. */
    @Transactional(readOnly = true)
    public List<Metal> heldMetals() {
        return Arrays.stream(Metal.values()).filter(metal -> pendingHeld(metal).isPresent()).toList();
    }

    /**
     * Above the limit, compared with the change as the admin panel shows it (one decimal, the frontend
     * {@code priceJump}): 10.04% is "10.0" and applied, 10.05% is "10.1" and held.
     */
    public boolean isLargeChange(BigDecimal changePercent) {
        return changePercent.abs().compareTo(properties.maxDailyChangePercent()) > 0;
    }

    /** {@code change_percent} is NUMERIC(7,2): an absurd jump is stored as the largest value it holds. */
    static BigDecimal storable(BigDecimal changePercent) {
        return changePercent.abs().compareTo(MAX_STORED_CHANGE) > 0
                ? MAX_STORED_CHANGE.multiply(BigDecimal.valueOf(changePercent.signum()))
                : changePercent;
    }

    private static final BigDecimal MAX_STORED_CHANGE = new BigDecimal("99999.99");
}
