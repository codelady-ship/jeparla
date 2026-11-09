package az.jeparla.product;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/** Buyer reports. Kept as evidence: no delete methods. */
public interface ProductReportRepository extends Repository<ProductReport, Long> {

    ProductReport save(ProductReport report);

    Optional<ProductReport> findById(Long id);

    /** Admin queue by status, newest first. */
    Page<ProductReport> findByStatusOrderByCreatedAtDesc(ReportStatus status, Pageable pageable);

    long countByProductIdAndStatus(Long productId, ReportStatus status);
}
