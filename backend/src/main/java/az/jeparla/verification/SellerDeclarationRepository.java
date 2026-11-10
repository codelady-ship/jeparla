package az.jeparla.verification;

import org.springframework.data.repository.Repository;

/** Seller declarations (#138): saved and read, never changed or deleted (no such methods; a trigger refuses both). */
public interface SellerDeclarationRepository extends Repository<SellerDeclaration, Long> {

    SellerDeclaration save(SellerDeclaration declaration);

    /** Whether the store's seller ever confirmed the declaration (a PRECIOUS product is published only then). */
    boolean existsByStoreId(Long storeId);
}
