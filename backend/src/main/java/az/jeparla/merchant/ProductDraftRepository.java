package az.jeparla.merchant;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Product drafts of a store (#129). */
interface ProductDraftRepository extends Repository<ProductDraft, Long> {

    ProductDraft save(ProductDraft draft);

    Optional<ProductDraft> findById(Long id);

    List<ProductDraft> findByStoreIdOrderByCreatedAtDescIdDesc(Long storeId);

    long countByStoreIdAndCreatedAtAfter(Long storeId, Instant after);

    void delete(ProductDraft draft);
}
