package az.jeparla.verification;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VerificationDocumentRepository extends JpaRepository<VerificationDocument, UUID> {

    /** Documents of one check of a store, newest first (seller cabinet and admin review). */
    List<VerificationDocument> findByStoreIdAndCheckKindOrderByCreatedAtDesc(Long storeId, CheckKind checkKind);

    List<VerificationDocument> findByProductIdOrderByCreatedAtDesc(Long productId);

    /** All documents of a store, newest first (seller cabinet). */
    List<VerificationDocument> findByStoreIdOrderByCreatedAtDesc(Long storeId);

    /** Ownership check for the seller: empty when the document is of another owner's store. */
    Optional<VerificationDocument> findByIdAndStoreOwnerId(UUID id, Long ownerId);

    /** Admin review queue, oldest first. */
    @Query(value = "select d from VerificationDocument d join fetch d.store left join fetch d.product"
            + " where d.status = :status order by d.createdAt asc, d.id asc",
            countQuery = "select count(d) from VerificationDocument d where d.status = :status")
    Page<VerificationDocument> findQueue(@Param("status") DocumentStatus status, Pageable pageable);

    /** The same file uploaded again for the store. */
    boolean existsByStoreIdAndSha256(Long storeId, String sha256);

    /** The same file is already waiting for review or accepted for the store. */
    boolean existsByStoreIdAndSha256AndStatusIn(Long storeId, String sha256, Collection<DocumentStatus> statuses);

    /** Statuses of the documents behind one check of a store (DOCUMENTS). */
    @Query("select d.status from VerificationDocument d where d.store.id = :storeId and d.checkKind = :checkKind")
    List<DocumentStatus> statusesOfStore(@Param("storeId") long storeId, @Param("checkKind") CheckKind checkKind);

    /** Kinds of the store's documents (DOCUMENTS check) an admin approved: the store facts (#108). */
    @Query("select distinct d.kind from VerificationDocument d where d.store.id = :storeId"
            + " and d.checkKind = az.jeparla.verification.CheckKind.DOCUMENTS"
            + " and d.status = az.jeparla.verification.DocumentStatus.VERIFIED")
    List<DocumentKind> verifiedDocumentKindsOfStore(@Param("storeId") long storeId);

    /** Statuses of the expertise documents of a product. */
    @Query("select d.status from VerificationDocument d where d.product.id = :productId"
            + " and d.checkKind = az.jeparla.verification.CheckKind.EXPERTISE")
    List<DocumentStatus> statusesOfProduct(@Param("productId") long productId);
}
