package az.jeparla.store;

import az.jeparla.verification.CheckStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StoreRepository extends JpaRepository<Store, Long> {

    // ------------------------------------------------------------------ public (#37)

    /** Public store page: only APPROVED stores are visible. */
    @Query("select s from Store s where s.slug = :slug and s.status = az.jeparla.store.StoreStatus.APPROVED")
    Optional<Store> findPublicBySlug(@Param("slug") String slug);

    /** Public store list. */
    @Query("select s from Store s where s.status = az.jeparla.store.StoreStatus.APPROVED")
    Page<Store> findPublic(Pageable pageable);

    /** Public store list of one city. */
    @Query("select s from Store s where s.status = az.jeparla.store.StoreStatus.APPROVED and s.city = :city")
    Page<Store> findPublicByCity(@Param("city") String city, Pageable pageable);

    /** Every public store, oldest first ({@code GET /api/v1/stores} filters this list by city and words). */
    @Query("select s from Store s where s.status = az.jeparla.store.StoreStatus.APPROVED order by s.id")
    List<Store> findAllPublic();

    /** Public APPROVED stores by slug, for the multi-store catalog filter. */
    @Query("select s from Store s where s.slug in :slugs and s.status = az.jeparla.store.StoreStatus.APPROVED")
    List<Store> findPublicBySlugIn(@Param("slugs") List<String> slugs);

    /** Product counts per APPROVED store: {@code [storeId, count]} of public products. */
    @Query("""
            select p.store.id, count(p) from Product p
            where p.status = az.jeparla.product.ProductStatus.APPROVED and p.deletedAt is null
              and p.materialKind = az.jeparla.product.MaterialKind.PRECIOUS
              and p.store.status = az.jeparla.store.StoreStatus.APPROVED
            group by p.store.id
            """)
    List<Object[]> countPublicProductsByStore();

    // ------------------------------------------------------------------ merchant (#34, #39)

    List<Store> findByOwnerIdOrderByCreatedAtAsc(Long ownerId);

    /** The merchant's store: one per account (unique index {@code stores_owner_key}, V13). */
    Optional<Store> findByOwnerId(Long ownerId);

    /** Ownership check: empty when the store does not exist or belongs to someone else. */
    Optional<Store> findByIdAndOwnerId(Long id, Long ownerId);

    boolean existsByIdAndOwnerId(Long id, Long ownerId);

    // ------------------------------------------------------------------ admin (#40)

    Page<Store> findByStatus(StoreStatus status, Pageable pageable);

    /** Seller identity-check queue: by seller check status, optionally of one marketplace status. */
    Page<Store> findBySellerStatus(CheckStatus sellerStatus, Pageable pageable);

    Page<Store> findByStatusAndSellerStatus(StoreStatus status, CheckStatus sellerStatus, Pageable pageable);

    /** Admin user list: the stores of these accounts (one per account). */
    List<Store> findByOwnerIdIn(Collection<Long> ownerIds);

    Optional<Store> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
