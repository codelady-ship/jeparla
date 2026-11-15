package az.jeparla.product;

import az.jeparla.common.persistence.NoDeleteRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Products. No delete methods: products are soft-deleted with {@link Product#softDelete}.
 *
 * <p>Public queries return only APPROVED, not deleted products of APPROVED stores and fetch the
 * store and category in the same statement. Images and variants are loaded in batches
 * ({@code hibernate.default_batch_fetch_size}), so a page costs a fixed number of statements
 * whatever its size (tested in ProductRepositoryTests).
 */
public interface ProductRepository extends NoDeleteRepository<Product, Long>, ProductSpecificationQueries {

    /**
     * JPQL condition of the public catalog; {@code p} is the product, {@code s} its store. PRECIOUS and
     * FASHION products alike ({@link Product#isPublic}, #128).
     */
    String PUBLIC = "p.status = az.jeparla.product.ProductStatus.APPROVED and p.deletedAt is null"
            + " and s.status = az.jeparla.store.StoreStatus.APPROVED";

    // ------------------------------------------------------------------ public (#37)

    @Query("select p from Product p join fetch p.store s join fetch p.category where p.slug = :slug and " + PUBLIC)
    Optional<Product> findPublicBySlug(@Param("slug") String slug);

    @Query(value = "select p from Product p join fetch p.store s join fetch p.category where " + PUBLIC,
            countQuery = "select count(p) from Product p join p.store s where " + PUBLIC)
    Page<Product> findPublic(Pageable pageable);

    /** Category page: pass the category and its descendants. */
    @Query(value = "select p from Product p join fetch p.store s join fetch p.category c"
            + " where c.id in :categoryIds and " + PUBLIC,
            countQuery = "select count(p) from Product p join p.store s where p.category.id in :categoryIds and " + PUBLIC)
    Page<Product> findPublicByCategoryIds(@Param("categoryIds") Collection<Long> categoryIds, Pageable pageable);

    /** Store page ({@code /stores/{slug}/products}). */
    @Query(value = "select p from Product p join fetch p.store s join fetch p.category where s.slug = :storeSlug and " + PUBLIC,
            countQuery = "select count(p) from Product p join p.store s where s.slug = :storeSlug and " + PUBLIC)
    Page<Product> findPublicByStoreSlug(@Param("storeSlug") String storeSlug, Pageable pageable);

    /** {@code [categoryId, count]} of public products, for the category tree counts. */
    @Query("select p.category.id, count(p) from Product p join p.store s where " + PUBLIC + " group by p.category.id")
    List<Object[]> countPublicByCategory();

    /**
     * JPQL condition of a listed product (#37): public and with at least one live variant, so it has
     * a price. {@code p} is the product.
     */
    String HAS_LIVE_VARIANT = "exists (select v.id from ProductVariant v where v.product = p and v.deletedAt is null)";

    /**
     * {@code [categoryId, count]} of listed products (public, with a live variant) per category.
     * The catalog API adds the counts of subcategories and drops hidden categories.
     */
    @Query("select p.category.id, count(p) from Product p join p.store s where " + PUBLIC + " and " + HAS_LIVE_VARIANT
            + " group by p.category.id")
    List<Object[]> countListedByCategory();

    /** {@code [storeId, count]} of listed products in the given (visible) categories, per store. */
    @Query("select s.id, count(p) from Product p join p.store s where " + PUBLIC + " and " + HAS_LIVE_VARIANT
            + " and p.category.id in :categoryIds group by s.id")
    List<Object[]> countListedByStore(@Param("categoryIds") Collection<Long> categoryIds);

    // ------------------------------------------------------------------ store facts and share preview (#100, #108)

    /** JPQL condition: a listed product of store {@code :storeId} in the given (visible) categories. */
    String LISTED_IN_STORE = "s.id = :storeId and " + PUBLIC + " and " + HAS_LIVE_VARIANT
            + " and p.category.id in :categoryIds";

    /** {@code [count, latest updatedAt]} of the store's listed products (one row; the time is null without any). */
    @Query("select count(p), max(p.updatedAt) from Product p join p.store s where " + LISTED_IN_STORE)
    List<Object[]> listedStatsOfStore(@Param("storeId") long storeId,
            @Param("categoryIds") Collection<Long> categoryIds);

    /** Listed products of the store whose physical expertise (assay certificate or lab report) an admin verified. */
    @Query("select count(p) from Product p join p.store s where " + LISTED_IN_STORE
            + " and p.expertiseStatus = az.jeparla.verification.CheckStatus.VERIFIED")
    long countListedWithVerifiedExpertise(@Param("storeId") long storeId,
            @Param("categoryIds") Collection<Long> categoryIds);

    /** Listed products of the store with at least one live METAL_LINKED variant (price follows the daily metal price). */
    @Query("select count(p) from Product p join p.store s where " + LISTED_IN_STORE
            + " and exists (select v.id from ProductVariant v where v.product = p and v.deletedAt is null"
            + " and v.pricingMode = az.jeparla.product.PricingMode.METAL_LINKED)")
    long countListedMetalLinked(@Param("storeId") long storeId, @Param("categoryIds") Collection<Long> categoryIds);

    /**
     * Listed products of the store with a hallmark photo a buyer can see (#106): any status except REJECTED, the
     * same rule as the product page.
     */
    @Query("select count(p) from Product p join p.store s where " + LISTED_IN_STORE
            + " and exists (select e.id from ProductEvidencePhoto e where e.product = p"
            + " and e.kind = az.jeparla.product.EvidenceKind.HALLMARK"
            + " and e.status <> az.jeparla.verification.CheckStatus.REJECTED)")
    long countListedWithHallmarkPhoto(@Param("storeId") long storeId,
            @Param("categoryIds") Collection<Long> categoryIds);

    /**
     * Image keys of the store's listed products, newest published product first and its cover (first image)
     * first: the first element is the store's share preview image.
     */
    @Query("select i.storageKey from ProductImage i join i.product p join p.store s where " + LISTED_IN_STORE
            + " order by p.publishedAt desc, p.id desc, i.sortOrder, i.id")
    List<String> listedImageKeysOfStore(@Param("storeId") long storeId,
            @Param("categoryIds") Collection<Long> categoryIds, Pageable pageable);

    // ------------------------------------------------------------------ merchant (#34, #39)

    /** Ownership check: empty when the product does not exist or its store belongs to someone else. */
    @Query("select p from Product p join fetch p.store s where p.id = :id and s.owner.id = :ownerId")
    Optional<Product> findByIdAndStoreOwnerId(@Param("id") Long id, @Param("ownerId") Long ownerId);

    @Query("select count(p) > 0 from Product p where p.id = :id and p.store.owner.id = :ownerId")
    boolean existsByIdAndStoreOwnerId(@Param("id") Long id, @Param("ownerId") Long ownerId);

    /** Merchant product list: every status except deleted. */
    @Query(value = "select p from Product p join fetch p.category where p.store.id = :storeId and p.deletedAt is null",
            countQuery = "select count(p) from Product p where p.store.id = :storeId and p.deletedAt is null")
    Page<Product> findByStoreId(@Param("storeId") Long storeId, Pageable pageable);

    /** Merchant product list without paging (#39): not deleted, last changed first. */
    @Query("select p from Product p join fetch p.category where p.store.id = :storeId and p.deletedAt is null"
            + " order by p.updatedAt desc, p.id desc")
    List<Product> findLiveByStoreId(@Param("storeId") Long storeId);

    /** A double-submitted create request (#39): the product its Idempotency-Key created. */
    Optional<Product> findByStoreIdAndIdempotencyKey(Long storeId, UUID idempotencyKey);

    /** Products of a kind the store still lists (a seller kind change must keep them allowed, #128). */
    @Query("select count(p) from Product p where p.store.id = :storeId and p.deletedAt is null"
            + " and p.materialKind = :kind")
    long countLiveByStoreIdAndMaterialKind(@Param("storeId") Long storeId, @Param("kind") MaterialKind kind);

    /** Merchant dashboard: {@code [status, count]} of the store's products, deleted ones excluded. */
    @Query("select p.status, count(p) from Product p where p.store.id = :storeId and p.deletedAt is null group by p.status")
    List<Object[]> countByStatusForStore(@Param("storeId") Long storeId);

    // ------------------------------------------------------------------ admin (#40)

    /** Moderation queue by status; sort with the pageable, e.g. by {@code submittedAt}. */
    @Query(value = "select p from Product p join fetch p.store join fetch p.category where p.status = :status",
            countQuery = "select count(p) from Product p where p.status = :status")
    Page<Product> findByStatus(@Param("status") ProductStatus status, Pageable pageable);

    Optional<Product> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /** Admin catalog settings: {@code [categoryId, count]} of products that are not deleted (any status). */
    @Query("select p.category.id, count(p) from Product p where p.deletedAt is null group by p.category.id")
    List<Object[]> countLiveByCategory();

    /** Any product row, deleted ones too (they keep the foreign key): the category cannot be deleted. */
    @Query("select count(p) > 0 from Product p where p.category.id = :categoryId")
    boolean existsByCategoryId(@Param("categoryId") Long categoryId);

    /** Admin store list: {@code [storeId, count]} of the stores' products that are not deleted (any status). */
    @Query("select p.store.id, count(p) from Product p where p.store.id in :storeIds and p.deletedAt is null"
            + " group by p.store.id")
    List<Object[]> countLiveByStoreIds(@Param("storeIds") Collection<Long> storeIds);
}
