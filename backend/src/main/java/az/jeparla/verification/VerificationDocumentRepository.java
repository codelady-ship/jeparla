package az.jeparla.verification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VerificationDocumentRepository extends JpaRepository<VerificationDocument, UUID> {

    /** Documents of one check of a store, newest first (seller cabinet and admin review). */
    List<VerificationDocument> findByStoreIdAndCheckKindOrderByCreatedAtDesc(Long storeId, CheckKind checkKind);

    List<VerificationDocument> findByProductIdOrderByCreatedAtDesc(Long productId);

    /** Ownership check for the seller: empty when the document is of another owner's store. */
    Optional<VerificationDocument> findByIdAndStoreOwnerId(UUID id, Long ownerId);

    /** Admin review queue, oldest first. */
    Page<VerificationDocument> findByStatusOrderByCreatedAtAsc(DocumentStatus status, Pageable pageable);

    /** The same file uploaded again for the store. */
    boolean existsByStoreIdAndSha256(Long storeId, String sha256);
}
