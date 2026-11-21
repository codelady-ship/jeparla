package az.jeparla.product.dto;

import az.jeparla.product.Audience;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Query parameters of {@code GET /api/v1/products} and {@code GET /api/v1/stores/{slug}/products}
 * ({@code ProductFilters} in frontend/src/types/api.ts, PLAN 5.5). Every filter is optional and they
 * combine with AND; list parameters repeat ({@code store=a&store=b}) or use commas
 * ({@code fineness=585,750}) and match any of their values. Invalid values give a 400 ProblemDetail.
 */
public record ProductQuery(
        @Parameter(description = "Words that must start a word of the product, store or category name "
                + "(Azerbaijani letters folded: uzuk = üzük)")
        @Size(max = MAX_QUERY_LENGTH) String q,

        @Parameter(description = "Category slug; includes its subcategories")
        @Size(max = 160) String category,

        @Parameter(description = "Occasion collection slug (#115), e.g. nisan; unknown or hidden: no products")
        @Size(max = 80) String collection,

        @Parameter(description = "Store slugs") @Size(max = MAX_VALUES) List<@Size(max = 160) String> store,

        @Parameter(description = "PRECIOUS (gold, silver, platinum, diamonds) or FASHION (bijouterie and handmade, #128)")
        MaterialKind kind,

        @Parameter(description = "Who the piece is for (#121): WOMEN and MEN also match UNISEX pieces, KIDS and UNISEX "
                + "match only themselves")
        Audience audience,

        @Parameter(description = "A metal; FASHION products have none, so they never match")
        Metal metal,

        @Parameter(description = "Fineness values in parts per thousand, e.g. 585")
        @Size(max = MAX_VALUES) List<@Min(1) @Max(1000) Integer> fineness,

        @Parameter(description = "Grams, decimal string") @DecimalMin("0") @Digits(integer = 5, fraction = 3)
        BigDecimal minWeight,
        @Parameter(description = "Grams, decimal string") @DecimalMin("0") @Digits(integer = 5, fraction = 3)
        BigDecimal maxWeight,

        @Parameter(description = "Lowest variant price (priceFrom), decimal string")
        @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal minPrice,
        @Parameter(description = "Lowest variant price (priceFrom), decimal string")
        @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal maxPrice,

        @Parameter(description = "Only products whose documents check passed (verification.documents = VERIFIED)")
        Boolean verified,

        @Parameter(description = "Only products whose seller added a hallmark photo (#106) that an admin has not "
                + "rejected")
        Boolean hallmarkPhoto,

        @Parameter(description = "Only products that can be bought or ordered (not OUT_OF_STOCK)")
        Boolean inStock,

        @Parameter(description = "Store city, exact, e.g. Bakı") @Size(max = 120) String city,

        @Parameter(description = "Diamond shapes, e.g. ROUND") @Size(max = MAX_VALUES) List<@Size(max = 40) String> shape,
        @Parameter(description = "Carat per diamond, decimal string") @DecimalMin("0") @Digits(integer = 5, fraction = 3)
        BigDecimal minCarat,
        @Parameter(description = "Carat per diamond, decimal string") @DecimalMin("0") @Digits(integer = 5, fraction = 3)
        BigDecimal maxCarat,
        @Parameter(description = "Diamond colours, e.g. F") @Size(max = MAX_VALUES) List<@Size(max = 40) String> color,
        @Parameter(description = "Diamond clarities, e.g. VS1") @Size(max = MAX_VALUES) List<@Size(max = 40) String> clarity,

        @Parameter(description = "relevance (default), newest, price_asc, price_desc, weight_asc")
        @Pattern(regexp = "relevance|newest|price_asc|price_desc|weight_asc") String sort,

        @Parameter(description = "Zero-based page, default 0") @Min(0) @Max(MAX_PAGE) Integer page,
        @Parameter(description = "Page size 1-" + MAX_SIZE + ", default " + DEFAULT_SIZE)
        @Min(1) @Max(MAX_SIZE) Integer size) {

    public static final int DEFAULT_SIZE = 24;
    public static final int MAX_SIZE = 96;
    public static final int MAX_PAGE = 10_000;
    public static final int MAX_VALUES = 20;
    public static final int MAX_QUERY_LENGTH = 100;

    /** No filters, first page. */
    public static ProductQuery none() {
        return new ProductQuery(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
    }

    /** The newest listed products of an occasion collection, first page (#115: collection covers). */
    public static ProductQuery newestInCollection(String collectionSlug, int size) {
        return new ProductQuery(null, null, collectionSlug, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, "newest", 0, size);
    }

    /** The same query restricted to one store ({@code /stores/{slug}/products}). */
    public ProductQuery inStore(String storeSlug) {
        return new ProductQuery(q, category, collection, List.of(storeSlug), kind, audience, metal, fineness, minWeight,
                maxWeight, minPrice, maxPrice, verified, hallmarkPhoto, inStock, city, shape, minCarat, maxCarat,
                color, clarity, sort, page, size);
    }

    public int pageOrDefault() {
        return page == null ? 0 : page;
    }

    public int sizeOrDefault() {
        return size == null ? DEFAULT_SIZE : size;
    }
}
