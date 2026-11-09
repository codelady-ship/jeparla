package az.jeparla.pricing;

import az.jeparla.pricing.dto.MetalPriceDto;
import az.jeparla.product.Metal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public reads of the stored quotes (#37): only APPLIED quotes, so a quote held by the sanity check
 * (#43) is never shown. Fetching from CBAR is #43; this only reads {@code metal_price_snapshots}.
 */
@Service
@Transactional(readOnly = true)
public class MetalPriceQueryService {

    private final MetalPriceSnapshotRepository snapshots;

    public MetalPriceQueryService(MetalPriceSnapshotRepository snapshots) {
        this.snapshots = snapshots;
    }

    /** The quote in use for every metal that has one, in the order GOLD, SILVER, PLATINUM, PALLADIUM. */
    public List<MetalPriceDto> latest() {
        return Arrays.stream(Metal.values())
                .map(metal -> snapshots.findFirstByMetalAndStatusOrderByQuoteDateDescIdDesc(metal, QuoteStatus.APPLIED))
                .flatMap(Optional::stream)
                .map(MetalPriceDto::of)
                .toList();
    }

    /** The last {@code days} quotes of a metal (business days with a quote), oldest first. */
    public List<MetalPriceDto> history(Metal metal, int days) {
        List<MetalPriceSnapshot> newestFirst = snapshots.findByMetalAndStatusOrderByQuoteDateDescIdDesc(metal,
                QuoteStatus.APPLIED, PageRequest.of(0, days));
        return newestFirst.reversed().stream().map(MetalPriceDto::of).toList();
    }
}
