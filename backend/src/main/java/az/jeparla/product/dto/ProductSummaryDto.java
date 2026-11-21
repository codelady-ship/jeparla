package az.jeparla.product.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.StockStatus;
import az.jeparla.store.dto.StoreRefDto;
import az.jeparla.verification.dto.VerificationDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A product card in lists ({@code ProductSummary} in frontend/src/types/api.ts).
 *
 * <p>The default variant is the one with the lowest price (ties: lowest id); {@code priceFrom},
 * {@code pricingMode}, {@code fineness} and {@code weightGrams} are its values. {@code stockStatus}
 * is the best of all live variants (IN_STOCK, then MADE_TO_ORDER, then OUT_OF_STOCK).
 *
 * <p>{@code materialKind} (#128): PRECIOUS has a metal and a fineness; FASHION (bijouterie, handmade) has
 * {@code metal} and {@code fineness} null, a {@code material} instead, FIXED prices and maybe no weight.
 */
@Schema(name = "ProductSummary", requiredProperties = {"id", "slug", "name", "categoryId", "store", "materialKind",
        "material", "metal",
        "priceFrom", "defaultVariantId", "pricingMode", "fineness", "weightGrams", "images", "hasStones",
        "verification", "stockStatus", "publishedAt"})
public record ProductSummaryDto(
        long id,
        String slug,
        LocalizedTextDto name,
        long categoryId,
        StoreRefDto store,
        MaterialKind materialKind,
        @Schema(nullable = true, description = "FASHION only") FashionMaterial material,
        @Schema(nullable = true, description = "Null for FASHION") Metal metal,
        @Schema(description = "Lowest live variant price") MoneyDto priceFrom,
        @Schema(description = "The variant priceFrom comes from") long defaultVariantId,
        PricingMode pricingMode,
        @Schema(nullable = true, description = "Fineness of the default variant, parts per thousand; null for FASHION",
                example = "585") Integer fineness,
        @Schema(nullable = true, example = "3.250") String weightGrams,
        List<ProductImageDto> images,
        boolean hasStones,
        VerificationDto verification,
        StockStatus stockStatus,
        @Schema(format = "date-time") String publishedAt,
        @Schema(nullable = true, description = "The short video (#117); left out when the product has none")
        @JsonInclude(JsonInclude.Include.NON_NULL) ProductVideoDto video) {
}
