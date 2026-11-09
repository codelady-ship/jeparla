package az.jeparla.pricing;

import az.jeparla.common.persistence.NoDeleteRepository;
import java.util.List;

/** Append-only price history: no update or delete through the API. */
public interface PriceHistoryRepository extends NoDeleteRepository<PriceHistory, Long> {

    List<PriceHistory> findByVariantIdOrderByCreatedAtDescIdDesc(Long variantId);

    /** The repricing job writes one row per variant and quote (#44). */
    boolean existsByVariantIdAndMetalSnapshotIdAndReason(Long variantId, Long metalSnapshotId, PriceChangeReason reason);
}
