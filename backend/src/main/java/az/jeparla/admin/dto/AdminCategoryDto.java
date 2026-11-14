package az.jeparla.admin.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.product.Category;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A category in the admin catalog settings (#40, PLAN 5.8): inactive ones too.
 *
 * @param productCount products of exactly this category that are not deleted, in any status (the public tree
 *                     counts listed products of the whole subtree instead)
 * @param childCount   direct subcategories; a category with children or products cannot be deleted
 */
@Schema(name = "AdminCategory", requiredProperties = {
        "id", "slug", "parentId", "name", "sortOrder", "active", "productCount", "childCount"})
public record AdminCategoryDto(long id, String slug, @Schema(nullable = true) Long parentId, LocalizedTextDto name,
        int sortOrder, boolean active, long productCount, long childCount) {

    public static AdminCategoryDto of(Category category, long productCount, long childCount) {
        return new AdminCategoryDto(category.getId(), category.getSlug(),
                category.getParent() == null ? null : category.getParent().getId(),
                LocalizedTextDto.of(category.getName()), category.getSortOrder(), category.isActive(), productCount,
                childCount);
    }
}
