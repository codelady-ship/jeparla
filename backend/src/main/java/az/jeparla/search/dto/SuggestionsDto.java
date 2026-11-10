package az.jeparla.search.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Header autocomplete ({@code Suggestions} in frontend/src/types/api.ts): up to 5 per group, best
 * first; every group is empty for a blank query.
 *
 * @param query the {@code q} parameter as sent ("" when missing)
 */
@Schema(name = "Suggestions", requiredProperties = {"query", "stores", "categories", "products"})
public record SuggestionsDto(
        String query,
        List<StoreSuggestion> stores,
        List<CategorySuggestion> categories,
        List<ProductSuggestion> products) {

    /** {@code Pick<StoreSummary, "slug" | "name" | "city">}. */
    @Schema(name = "StoreSuggestion", requiredProperties = {"slug", "name", "city"})
    public record StoreSuggestion(String slug, String name, String city) {
    }

    /** {@code Pick<Category, "slug" | "name">}. */
    @Schema(name = "CategorySuggestion", requiredProperties = {"slug", "name"})
    public record CategorySuggestion(String slug, LocalizedTextDto name) {
    }

    /** {@code Pick<ProductSummary, "slug" | "name" | "priceFrom">}; priceFrom is the cheapest live variant. */
    @Schema(name = "ProductSuggestion", requiredProperties = {"slug", "name", "priceFrom"})
    public record ProductSuggestion(String slug, LocalizedTextDto name, MoneyDto priceFrom) {
    }
}
