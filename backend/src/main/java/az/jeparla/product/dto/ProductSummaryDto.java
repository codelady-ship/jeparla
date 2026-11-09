package az.jeparla.product.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.StockStatus;
import az.jeparla.store.dto.StoreRefDto;
import az.jeparla.verification.dto.VerificationDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A product card in lists ({@code ProductSummary} in frontend/src/types/api.ts).
 *
 * <p>The default variant is the one with the lowest price (ties: lowest id); {@code priceFrom},
 * {@code pricingMode}, {@code fineness} and {@code weightGrams} are its values. {@code stockStatus}
 * is the best of all live variants (IN_STOCK, then MADE_TO_ORDER, then OUT_OF_STOCK).
 */
@Schema(name = "ProductSummary", requiredProperties = {"id", "slug", "name", "categoryId", "store", "metal",
        "priceFrom", "defaultVariantId", "pricingMode", "fineness", "weightGrams", "images", "hasStones",
        "verification", "stockStatus", "publishedAt"})
public record ProductSummaryDto(
        long id,
        String slug,
        LocalizedTextDto name,
        long categoryId,
        StoreRefDto store,
        Metal metal,
        @Schema(description = "Lowest live variant price") MoneyDto priceFrom,
        @Schema(description = "The variant priceFrom comes from") long defaultVariantId,
        PricingMode pricingMode,
        @Schema(description = "Fineness of the default variant, parts per thousand", example = "585") int fineness,
        @Schema(example = "3.250") String weightGrams,
        List<ProductImageDto> images,
        boolean hasStones,
        VerificationDto verification,
        StockStatus stockStatus,
        @Schema(format = "date-time") String publishedAt) {
}
