package az.jeparla.merchant.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.ProductStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * One row of /merchant/products ({@code MerchantProductRow} in frontend/src/types/merchant.ts).
 *
 * @param priceFrom     the cheapest live variant price, or null without variants
 * @param views         null: product views are not counted yet (see {@link MerchantDashboardDto})
 * @param aiReviewCount AI Studio results of this product that wait for the seller's approval (#316)
 */
@Schema(name = "MerchantProductRow")
public record MerchantProductRowDto(
        long id,
        String slug,
        LocalizedTextDto name,
        @Schema(nullable = true) String imageUrl,
        long categoryId,
        ProductStatus status,
        MaterialKind materialKind,
        @Schema(nullable = true, example = "1248.50") String priceFrom,
        int variantCount,
        @Schema(nullable = true) Long views,
        Instant updatedAt,
        @Schema(nullable = true) String reviewNote,
        int aiReviewCount) {
}
