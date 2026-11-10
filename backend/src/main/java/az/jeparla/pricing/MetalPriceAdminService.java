package az.jeparla.pricing;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.dto.Decimal;
import az.jeparla.common.error.ApiException;
import az.jeparla.pricing.dto.AdminMetalPriceDto;
import az.jeparla.pricing.dto.AdminMetalPriceDto.HeldQuoteDto;
import az.jeparla.product.Metal;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin side of the metal prices (#43, PLAN 5.8 / 5.10): the prices in use with the quotes held by the
 * sanity check, the decision on a held quote, and the manual override. Every change is written to the
 * audit log. Repricing after a change is done by the caller ({@link MetalPriceJob}), outside this
 * transaction.
 */
@Service
public class MetalPriceAdminService {

    /** Same limits as the admin forms (REASON_MIN / REASON_MAX in frontend/src/lib/admin/decisions.ts). */
    static final int REASON_MIN = 10;

    private static final Logger log = LoggerFactory.getLogger(MetalPriceAdminService.class);

    /** A decided or overridden quote, for the response. */
    public record Change(MetalPriceSnapshot quote, BigDecimal change) {
    }

    private final MetalPriceSnapshotRepository snapshots;
    private final MetalQuoteService quotes;
    private final UserRepository users;
    private final AuditService audit;
    private final MetalPriceProperties properties;
    private final Clock clock;

    public MetalPriceAdminService(MetalPriceSnapshotRepository snapshots, MetalQuoteService quotes,
            UserRepository users, AuditService audit, MetalPriceProperties properties, Clock clock) {
        this.snapshots = snapshots;
        this.quotes = quotes;
        this.users = users;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
    }

    /** The price in use of every metal that has one, with its held quote. */
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<AdminMetalPriceDto> list() {
        return Arrays.stream(Metal.values())
                .map(this::adminView)
                .flatMap(Optional::stream)
                .toList();
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Change decideHeld(Metal metal, String action, String rawReason) {
        String reason = rawReason == null ? "" : rawReason.strip();
        boolean accept = "accept".equals(action);
        if (!accept && reason.length() < REASON_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "reason");
        }
        MetalPriceSnapshot held = pendingHeld(metal)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "metal_prices.nothing_held"));
        Optional<MetalPriceSnapshot> inUse = inUse(metal);
        BigDecimal change = inUse.map(q -> PricingEngine.percentChange(q.getPricePerOunce(), held.getPricePerOunce()))
                .orElse(BigDecimal.ZERO.setScale(1));
        held.decide(accept ? QuoteStatus.APPLIED : QuoteStatus.DISCARDED, admin(), reason.isEmpty() ? null : reason,
                clock.instant());
        audit.record(accept ? "METAL_PRICE_ACCEPTED" : "METAL_PRICE_DISCARDED", AuditTargetType.PRICE, held.getId(),
                label(held), reason.isEmpty() ? null : reason, details(held, change));
        log.warn("Held metal price {} {} {} AZN/oz {} by admin {}", metal, held.getQuoteDate(),
                held.getPricePerOunce(), accept ? "ACCEPTED" : "DISCARDED", CurrentUser.id());
        return new Change(held, change);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Change override(Metal metal, String rawPrice, String rawReason, boolean confirmLarge) {
        String reason = rawReason == null ? "" : rawReason.strip();
        if (reason.length() < REASON_MIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "reason");
        }
        BigDecimal ounce = new BigDecimal(rawPrice.strip().replace(',', '.'));
        if (ounce.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "metal_prices.price_format", "pricePerOunce");
        }
        Optional<MetalPriceSnapshot> inUse = inUse(metal);
        BigDecimal change = inUse.map(q -> PricingEngine.percentChange(q.getPricePerOunce(), ounce))
                .orElse(BigDecimal.ZERO.setScale(1));
        if (quotes.isLargeChange(change) && !confirmLarge) {
            throw new ApiException(HttpStatus.CONFLICT, "metal_prices.large_change", "pricePerOunce");
        }
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, properties.zone());
        MetalPriceSnapshot snapshot = new MetalPriceSnapshot(metal, today, ounce, PricingEngine.gramPrice(ounce),
                QuoteSource.ADMIN, now);
        snapshot.setChangePercent(MetalQuoteService.storable(change));
        snapshot.decide(QuoteStatus.APPLIED, admin(), reason, now);
        snapshots.save(snapshot);
        audit.record("METAL_PRICE_OVERRIDDEN", AuditTargetType.PRICE, snapshot.getId(), label(snapshot), reason,
                details(snapshot, change));
        log.warn("Metal price {} overridden by admin {}: {} AZN/oz ({}%) for {}", metal, CurrentUser.id(), ounce,
                change, today);
        return new Change(snapshot, change);
    }

    private Optional<AdminMetalPriceDto> adminView(Metal metal) {
        List<MetalPriceSnapshot> lastTwo = snapshots.findByMetalAndStatusOrderByQuoteDateDescIdDesc(metal,
                QuoteStatus.APPLIED, PageRequest.of(0, 2));
        if (lastTwo.isEmpty()) {
            return Optional.empty();
        }
        MetalPriceSnapshot inUse = lastTwo.getFirst();
        MetalPriceSnapshot previous = lastTwo.size() > 1 ? lastTwo.get(1) : inUse;
        HeldQuoteDto held = pendingHeld(metal)
                .map(q -> new HeldQuoteDto(q.getQuoteDate().toString(), Decimal.of(q.getPricePerOunce()),
                        PricingEngine.percentChange(inUse.getPricePerOunce(), q.getPricePerOunce()).toPlainString(),
                        q.getStatus().name()))
                .orElse(null);
        return Optional.of(new AdminMetalPriceDto(metal, inUse.getQuoteDate().toString(),
                Decimal.of(inUse.getPricePerOunce()), Decimal.of(inUse.getPricePerGram()),
                Decimal.of(previous.getPricePerOunce()),
                PricingEngine.percentChange(previous.getPricePerOunce(), inUse.getPricePerOunce()).toPlainString(),
                inUse.getSource(), held));
    }

    private Optional<MetalPriceSnapshot> inUse(Metal metal) {
        return quotes.inUse(metal);
    }

    private Optional<MetalPriceSnapshot> pendingHeld(Metal metal) {
        return quotes.pendingHeld(metal);
    }

    private User admin() {
        return users.findById(CurrentUser.id()).orElse(null);
    }

    private static String label(MetalPriceSnapshot quote) {
        return quote.getMetal() + " " + quote.getQuoteDate() + " " + quote.getSource();
    }

    private static String details(MetalPriceSnapshot quote, BigDecimal change) {
        return "{\"pricePerOunce\":\"" + quote.getPricePerOunce().toPlainString() + "\",\"pricePerGram\":\""
                + quote.getPricePerGram().toPlainString() + "\",\"changePercent\":\"" + change.toPlainString() + "\"}";
    }
}
