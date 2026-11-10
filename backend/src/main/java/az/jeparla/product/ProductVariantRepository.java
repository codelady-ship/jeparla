package az.jeparla.product;

import az.jeparla.common.persistence.NoDeleteRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Variants. No delete methods: a removed variant keeps its row ({@code deleted_at}) because the
 * price history references it.
 */
public interface ProductVariantRepository extends NoDeleteRepository<ProductVariant, Long> {

    /** Ownership check for the merchant API (#39). */
    @Query("""
            select v from ProductVariant v join fetch v.product p
            where v.id = :id and v.deletedAt is null and p.store.owner.id = :ownerId
            """)
    Optional<ProductVariant> findLiveByIdAndOwnerId(@Param("id") Long id, @Param("ownerId") Long ownerId);

    /**
     * Compare page (#37): live variants of public products, with product, store and fineness in the
     * same statement. Unknown, removed or hidden ids are simply missing.
     */
    @Query("select v from ProductVariant v join fetch v.product p join fetch p.store s join fetch v.fineness"
            + " where v.id in :ids and v.deletedAt is null and " + ProductRepository.PUBLIC)
    List<ProductVariant> findPublicLiveByIdIn(@Param("ids") Collection<Long> ids);

    /** SKU is unique per store among live variants (partial unique index). */
    @Query("select count(v) > 0 from ProductVariant v where v.storeId = :storeId and v.sku = :sku and v.deletedAt is null")
    boolean existsLiveSku(@Param("storeId") Long storeId, @Param("sku") String sku);

    /** Daily repricing (#44): live METAL_LINKED variants of one metal, with fineness and product. */
    @Query("""
            select v from ProductVariant v join fetch v.fineness f join fetch v.product p
            where v.pricingMode = az.jeparla.product.PricingMode.METAL_LINKED
              and v.deletedAt is null and f.metal = :metal
            order by v.id
            """)
    List<ProductVariant> findLiveMetalLinked(@Param("metal") Metal metal);

    /** Daily repricing (#44): ids of the live METAL_LINKED variants of one metal, processed in batches. */
    @Query("""
            select v.id from ProductVariant v join v.fineness f
            where v.pricingMode = az.jeparla.product.PricingMode.METAL_LINKED
              and v.deletedAt is null and f.metal = :metal
            order by v.id
            """)
    List<Long> findLiveMetalLinkedIds(@Param("metal") Metal metal);

    /** One repricing batch: the variants with their fineness (the quote is compared by id only). */
    @Query("select v from ProductVariant v join fetch v.fineness where v.id in :ids order by v.id")
    List<ProductVariant> findWithFinenessByIdIn(@Param("ids") Collection<Long> ids);
}
