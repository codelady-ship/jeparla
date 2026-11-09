package az.jeparla.product;

import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import jakarta.persistence.criteria.CommonAbstractCriteria;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
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

    // ------------------------------------------------------------------ public catalog API (#37)

    /** At least one live variant: a product without one has no price and is not listed. */
    public static Specification<Product> hasLiveVariant() {
        return withVariant((variant, cb) -> cb.conjunction());
    }

    public static Specification<Product> withIds(Collection<Long> ids) {
        return (root, query, cb) -> root.get("id").in(ids);
    }

    /**
     * "Only verified" filter of the catalog, as the frontend mock applies it: the documents check
     * ({@code verification.documents} of the product card, i.e. the store documents) passed.
     */
    public static Specification<Product> documentsVerified() {
        return (root, query, cb) -> cb.equal(root.get("store").get("documentsStatus"), CheckStatus.VERIFIED);
    }

    /** "In stock" filter as in the frontend: something can be bought or ordered (not OUT_OF_STOCK). */
    public static Specification<Product> available() {
        return withVariant((variant, cb) -> cb.notEqual(variant.get("stockStatus"), StockStatus.OUT_OF_STOCK));
    }

    /** Price range on {@code priceFrom}, the lowest live variant price shown on the card; null bound is open. */
    public static Specification<Product> withPriceFromBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> between(cb, lowestVariant(root, query, cb, "price"), min, max);
    }

    /**
     * Diamond filters (PLAN 5.3): one DIAMOND stone of the product matches every given condition.
     * Empty collections and null bounds are ignored; values are compared exactly (ROUND, F, VS1).
     */
    public static Specification<Product> withDiamond(Collection<String> shapes, BigDecimal minCarat,
            BigDecimal maxCarat, Collection<String> colors, Collection<String> clarities) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<ProductStone> stone = sub.from(ProductStone.class);
            List<Predicate> conditions = new ArrayList<>();
            conditions.add(cb.equal(stone.get("product"), root));
            conditions.add(cb.equal(stone.get("stoneType"), StoneType.DIAMOND));
            if (shapes != null && !shapes.isEmpty()) {
                conditions.add(stone.get("shape").in(shapes));
            }
            if (colors != null && !colors.isEmpty()) {
                conditions.add(stone.get("color").in(colors));
            }
            if (clarities != null && !clarities.isEmpty()) {
                conditions.add(stone.get("clarity").in(clarities));
            }
            if (minCarat != null || maxCarat != null) {
                conditions.add(between(cb, stone.get("carat"), minCarat, maxCarat));
            }
            sub.select(stone.get("id")).where(conditions.toArray(Predicate[]::new));
            return cb.exists(sub);
        };
    }

    /**
     * Simple word search of the catalog list ({@code q}): every word is the start of a word in the
     * product names (az, en, ru), the store name or city, or the category names, like the frontend
     * mock. Words must be folded with {@link az.jeparla.common.i18n.SearchText#fold}. Ranked full-text search is #38.
     */
    public static Specification<Product> matchingWords(List<String> foldedWords) {
        return (root, query, cb) -> {
            Expression<String> text = cb.concat(List.of(
                    cb.literal(" "), cb.coalesce(root.<String>get("searchText"), ""),
                    cb.literal(" "), cb.coalesce(root.get("store").<String>get("searchText"), ""),
                    cb.literal(" "), cb.coalesce(root.get("category").<String>get("searchText"), "")));
            return cb.and(foldedWords.stream()
                    .map(word -> cb.like(text, "% " + word + "%"))
                    .toArray(Predicate[]::new));
        };
    }

    /** {@code (select min(v.<attribute>) from live variants of the product)}, for filters and sorting. */
    static Subquery<BigDecimal> lowestVariant(Root<Product> root, CommonAbstractCriteria query, CriteriaBuilder cb,
            String attribute) {
        Subquery<BigDecimal> sub = query.subquery(BigDecimal.class);
        Root<ProductVariant> variant = sub.from(ProductVariant.class);
        sub.select(cb.min(variant.get(attribute)))
                .where(cb.equal(variant.get("product"), root), cb.isNull(variant.get("deletedAt")));
        return sub;
    }

    private static Predicate between(CriteriaBuilder cb, Expression<BigDecimal> path, BigDecimal min, BigDecimal max) {
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
