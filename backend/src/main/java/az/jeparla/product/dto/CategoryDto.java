package az.jeparla.product.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A node of the category tree ({@code Category} in frontend/src/types/api.ts). The list is flat; the
 * tree comes from {@code parentId}.
 *
 * @param productCount listed products of this category and all its subcategories
 */
@Schema(name = "Category", requiredProperties = {"id", "slug", "parentId", "name", "productCount"})
public record CategoryDto(long id, String slug, @Schema(nullable = true) Long parentId, LocalizedTextDto name,
        long productCount) {
}
