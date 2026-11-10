package az.jeparla.search.dto;

import az.jeparla.common.dto.PageDto;
import az.jeparla.product.dto.CategoryDto;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.store.dto.StoreSummaryDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Grouped search results ({@code SearchResult} in frontend/src/types/api.ts), each group best first.
 * The counts per type are {@code products.totalElements}, {@code stores.length} and
 * {@code categories.length}; products are paged, stores and categories are not (at most 100 each).
 *
 * @param query the {@code q} parameter as sent ("" when missing)
 */
@Schema(name = "SearchResult", requiredProperties = {"query", "products", "stores", "categories"})
public record SearchResultDto(
        String query,
        PageDto<ProductSummaryDto> products,
        List<StoreSummaryDto> stores,
        List<CategoryDto> categories) {
}
