package az.jeparla.pricing;

import az.jeparla.product.Metal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetalPriceSnapshotRepository extends JpaRepository<MetalPriceSnapshot, Long> {

    /** The quote in use for a metal: the latest APPLIED one. */
    Optional<MetalPriceSnapshot> findFirstByMetalAndStatusOrderByQuoteDateDescIdDesc(Metal metal, QuoteStatus status);

    /** History chart: APPLIED quotes of a metal in a date range, oldest first. */
    List<MetalPriceSnapshot> findByMetalAndStatusAndQuoteDateBetweenOrderByQuoteDateAsc(Metal metal,
            QuoteStatus status, LocalDate from, LocalDate to);

    /** History endpoint (#37): the latest APPLIED quotes of a metal, newest first; limit with the pageable. */
    List<MetalPriceSnapshot> findByMetalAndStatusOrderByQuoteDateDescIdDesc(Metal metal, QuoteStatus status,
            Pageable pageable);

    /** Idempotent fetch job (#43): is this day already stored? */
    Optional<MetalPriceSnapshot> findByMetalAndQuoteDateAndSource(Metal metal, LocalDate quoteDate, QuoteSource source);

    /** Admin queue of quotes held by the sanity check. */
    List<MetalPriceSnapshot> findByStatusOrderByQuoteDateAsc(QuoteStatus status);
}
