package az.jeparla.product;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Buyer reports about products and stores. Kept as evidence: no delete methods. The admin queue methods sort with
 * the pageable; "product is null" is a complaint about the store as a whole.
 */
public interface ProductReportRepository extends Repository<ProductReport, Long> {

    ProductReport save(ProductReport report);

    Optional<ProductReport> findById(Long id);

    /** The report locked until the transaction ends, so two admins cannot close it twice. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ProductReport r where r.id = :id")
    Optional<ProductReport> findForUpdateById(@Param("id") Long id);

    /** Admin queue by status, newest first. */
    Page<ProductReport> findByStatusOrderByCreatedAtDesc(ReportStatus status, Pageable pageable);

    long countByProductIdAndStatus(Long productId, ReportStatus status);

    // ------------------------------------------------------------------ admin queue (#40)

    Page<ProductReport> findByStatus(ReportStatus status, Pageable pageable);

    Page<ProductReport> findByStatusAndProductIsNull(ReportStatus status, Pageable pageable);

    Page<ProductReport> findByStatusAndProductIsNotNull(ReportStatus status, Pageable pageable);

    Page<ProductReport> findByStatusAndStoreId(ReportStatus status, Long storeId, Pageable pageable);

    Page<ProductReport> findByStatusAndStoreIdAndProductIsNull(ReportStatus status, Long storeId, Pageable pageable);

    Page<ProductReport> findByStatusAndStoreIdAndProductIsNotNull(ReportStatus status, Long storeId,
            Pageable pageable);
}
