package az.jeparla.verification;

import az.jeparla.common.persistence.NoDeleteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Suspension requests (#138): kept as evidence, never deleted. */
public interface StoreSuspensionRequestRepository extends NoDeleteRepository<StoreSuspensionRequest, Long> {

    /** The queue by status, oldest first, with the store. */
    @Query(value = "select r from StoreSuspensionRequest r join fetch r.store where r.status = :status"
            + " order by r.requestedAt, r.id",
            countQuery = "select count(r) from StoreSuspensionRequest r where r.status = :status")
    Page<StoreSuspensionRequest> findQueue(@Param("status") StoreSuspensionRequest.Status status, Pageable pageable);

    boolean existsByStoreIdAndStatus(Long storeId, StoreSuspensionRequest.Status status);
}
