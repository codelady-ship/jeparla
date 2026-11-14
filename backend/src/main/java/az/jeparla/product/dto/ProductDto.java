package az.jeparla.product.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.ProductStatus;
import az.jeparla.product.StockStatus;
import az.jeparla.store.dto.StoreRefDto;
import az.jeparla.verification.dto.VerificationDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Product page ({@code Product} = {@code ProductSummary} + description, variants, stones and status in
 * frontend/src/types/api.ts). The JSON is flat, like the TypeScript intersection type.
 */
@Schema(name = "Product", requiredProperties = {"id", "slug", "name", "categoryId", "store", "metal", "priceFrom",
        "defaultVariantId", "pricingMode", "fineness", "weightGrams", "images", "hasStones", "verification",
        "stockStatus", "publishedAt", "description", "variants", "stones", "status", "evidencePhotos"})
public record ProductDto(
        long id,
        String slug,
        LocalizedTextDto name,
        long categoryId,
        StoreRefDto store,
        Metal metal,
        MoneyDto priceFrom,
        long defaultVariantId,
        PricingMode pricingMode,
        int fineness,
        String weightGrams,
        List<ProductImageDto> images,
        boolean hasStones,
        VerificationDto verification,
        StockStatus stockStatus,
        @Schema(format = "date-time") String publishedAt,
        LocalizedTextDto description,
        List<VariantDto> variants,
        List<StoneDto> stones,
        @Schema(description = "Always APPROVED in the public API") ProductStatus status,
        @Schema(description = "Hallmark and label photos (#106), HALLMARK first; empty when the seller added none")
        List<EvidencePhotoDto> evidencePhotos) {

    public static ProductDto of(ProductSummaryDto summary, LocalizedTextDto description, List<VariantDto> variants,
            List<StoneDto> stones, ProductStatus status, List<EvidencePhotoDto> evidencePhotos) {
        return new ProductDto(summary.id(), summary.slug(), summary.name(), summary.categoryId(), summary.store(),
                summary.metal(), summary.priceFrom(), summary.defaultVariantId(), summary.pricingMode(),
                summary.fineness(), summary.weightGrams(), summary.images(), summary.hasStones(),
                summary.verification(), summary.stockStatus(), summary.publishedAt(), description, variants, stones,
                status, evidencePhotos);
    }
}
