package az.jeparla.product;

import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.BiFunction;
import org.springframework.data.jpa.domain.Specification;

/**
 * Catalog filters (PLAN 5.3, {@code ProductFilters} in frontend/src/types/api.ts) as composable
 * specifications for {@link ProductRepository#findAllMatching}. Variant filters match a product
 * when at least one live variant matches. #37 maps the request parameters to these.
 */
public final class ProductSpecifications {

    private ProductSpecifications() {
    }

    /** APPROVED, not deleted, of an APPROVED store: the only products the public sees. */
    public static Specification<Product> isPublic() {
        return (root, query, cb) -> cb.and(
                cb.equal(root.get("status"), ProductStatus.APPROVED),
                cb.isNull(root.get("deletedAt")),
                cb.equal(root.get("store").get("status"), StoreStatus.APPROVED));
    }

    public static Specification<Product> inCategories(Collection<Long> categoryIds) {
        return (root, query, cb) -> root.get("category").get("id").in(categoryIds);
    }

    public static Specification<Product> inStores(Collection<String> storeSlugs) {
        return (root, query, cb) -> root.get("store").get("slug").in(storeSlugs);
    }

    public static Specification<Product> inCity(String city) {
        return (root, query, cb) -> cb.equal(root.get("store").get("city"), city);
    }

    public static Specification<Product> ofMetal(Metal metal) {
        return (root, query, cb) -> cb.equal(root.get("metal"), metal);
    }

    /** "Jeparla Verified" filter: the seller check of the store passed. */
    public static Specification<Product> verifiedSeller() {
        return (root, query, cb) -> cb.equal(root.get("store").get("sellerStatus"), CheckStatus.VERIFIED);
    }

    /** Fineness values in parts per thousand, e.g. 585 and 750. */
    public static Specification<Product> withFineness(Collection<Integer> values) {
        List<Short> shorts = values.stream().map(Integer::shortValue).toList();
        return withVariant((variant, cb) -> variant.get("fineness").get("value").in(shorts));
    }

    /** Price range in the variant currency; a null bound is open. */
    public static Specification<Product> withPriceBetween(BigDecimal min, BigDecimal max) {
        return withVariant((variant, cb) -> between(cb, variant.get("price"), min, max));
    }

    /** Weight range in grams; a null bound is open. */
    public static Specification<Product> withWeightBetween(BigDecimal min, BigDecimal max) {
        return withVariant((variant, cb) -> between(cb, variant.get("weightGrams"), min, max));
    }

    public static Specification<Product> inStock() {
        return withVariant((variant, cb) -> cb.equal(variant.get("stockStatus"), StockStatus.IN_STOCK));
    }

    private static Predicate between(CriteriaBuilder cb, jakarta.persistence.criteria.Path<BigDecimal> path,
            BigDecimal min, BigDecimal max) {
        List<Predicate> bounds = new ArrayList<>(2);
        if (min != null) {
            bounds.add(cb.greaterThanOrEqualTo(path, min));
        }
        if (max != null) {
            bounds.add(cb.lessThanOrEqualTo(path, max));
        }
        return cb.and(bounds.toArray(Predicate[]::new));
    }

    /** {@code EXISTS (live variant of this product matching the condition)}. */
    private static Specification<Product> withVariant(BiFunction<Root<ProductVariant>, CriteriaBuilder, Predicate> condition) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<ProductVariant> variant = sub.from(ProductVariant.class);
            sub.select(variant.get("id")).where(
                    cb.equal(variant.get("product"), root),
                    cb.isNull(variant.get("deletedAt")),
                    condition.apply(variant, cb));
            return cb.exists(sub);
        };
    }
}
