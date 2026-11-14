package az.jeparla.product;

import az.jeparla.verification.CheckStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** Hallmark and label photos (#106). The merchant side changes them through {@link Product}. */
public interface ProductEvidencePhotoRepository extends JpaRepository<ProductEvidencePhoto, Long> {

    /** Admin queue: photos of not deleted products with {@code status}, product and store in the same statement. */
    @EntityGraph(attributePaths = {"product", "product.store"})
    Page<ProductEvidencePhoto> findByStatusAndProductDeletedAtIsNull(CheckStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"product", "product.store"})
    Optional<ProductEvidencePhoto> findWithProductById(long id);
}
