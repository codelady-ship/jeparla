package az.jeparla.search.dto;

import az.jeparla.product.Metal;
import az.jeparla.product.dto.ProductQuery;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Result filters of search by photo (#163), with the same meaning as on {@code GET /api/v1/products}: they narrow
 * the most similar products and combine with AND. All optional; form fields or query parameters.
 */
public record ImageSearchFilters(
        @Parameter(description = "Category slug; includes its subcategories") @Size(max = 160) String category,
        @Parameter(description = "A metal") Metal metal,
        @Parameter(description = "Fineness values in parts per thousand, e.g. 585")
        @Size(max = ProductQuery.MAX_VALUES) List<@Min(1) @Max(1000) Integer> fineness,
        @Parameter(description = "Lowest variant price (priceFrom), decimal string")
        @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal minPrice,
        @Parameter(description = "Lowest variant price (priceFrom), decimal string")
        @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal maxPrice,
        @Parameter(description = "Store slugs")
        @Size(max = ProductQuery.MAX_VALUES) List<@Size(max = 160) String> store,
        @Parameter(description = "Store city, exact, e.g. Bakı") @Size(max = 120) String city) {

    /** Whether any filter is set. */
    public boolean any() {
        return notBlank(category) || metal != null || (fineness != null && !fineness.isEmpty()) || minPrice != null
                || maxPrice != null || (store != null && !store.isEmpty()) || notBlank(city);
    }

    /** The same filters as a catalog query; null when none is set. */
    public ProductQuery toQuery() {
        if (!any()) {
            return null;
        }
        return new ProductQuery(null, blankToNull(category), emptyToNull(store), null, null, metal,
                emptyToNull(fineness), null, null, minPrice, maxPrice, null, null, null, blankToNull(city), null, null,
                null, null, null, null, null, null);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String blankToNull(String value) {
        return notBlank(value) ? value.strip() : null;
    }

    private static <T> List<T> emptyToNull(List<T> values) {
        return values == null || values.isEmpty() ? null : values;
    }
}
