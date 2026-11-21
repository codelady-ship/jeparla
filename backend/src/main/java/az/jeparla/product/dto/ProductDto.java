package az.jeparla.product.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.ProductStatus;
import az.jeparla.product.StockStatus;
import az.jeparla.store.dto.StoreRefDto;
import az.jeparla.verification.dto.VerificationDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Product page ({@code Product} = {@code ProductSummary} + description, variants, stones and status in
 * frontend/src/types/api.ts). The JSON is flat, like the TypeScript intersection type.
 */
@Schema(name = "Product", requiredProperties = {"id", "slug", "name", "categoryId", "store", "materialKind",
        "material", "metal", "priceFrom",
        "defaultVariantId", "pricingMode", "fineness", "weightGrams", "images", "hasStones", "verification",
        "stockStatus", "publishedAt", "description", "variants", "stones", "status", "evidencePhotos"})
public record ProductDto(
        long id,
        String slug,
        LocalizedTextDto name,
        long categoryId,
        StoreRefDto store,
        MaterialKind materialKind,
        @Schema(nullable = true) FashionMaterial material,
        @Schema(nullable = true) Metal metal,
        MoneyDto priceFrom,
        long defaultVariantId,
        PricingMode pricingMode,
        @Schema(nullable = true) Integer fineness,
        @Schema(nullable = true) String weightGrams,
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
        List<EvidencePhotoDto> evidencePhotos,
        @Schema(nullable = true, description = "Sizes in mm (#174); left out when the seller entered none")
        @JsonInclude(JsonInclude.Include.NON_NULL) DimensionsDto dimensions,
        @Schema(description = "Up to 5 key features the seller wrote (#174); left out when none")
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<String> keyFeatures,
        @Schema(nullable = true, description = "The short video (#117); left out when the product has none")
        @JsonInclude(JsonInclude.Include.NON_NULL) ProductVideoDto video) {

    public static ProductDto of(ProductSummaryDto summary, LocalizedTextDto description, List<VariantDto> variants,
            List<StoneDto> stones, ProductStatus status, List<EvidencePhotoDto> evidencePhotos,
            DimensionsDto dimensions, List<String> keyFeatures) {
        return new ProductDto(summary.id(), summary.slug(), summary.name(), summary.categoryId(), summary.store(),
                summary.materialKind(), summary.material(), summary.metal(), summary.priceFrom(), summary.defaultVariantId(), summary.pricingMode(),
                summary.fineness(), summary.weightGrams(), summary.images(), summary.hasStones(),
                summary.verification(), summary.stockStatus(), summary.publishedAt(), description, variants, stones,
                status, evidencePhotos, dimensions, keyFeatures, summary.video());
    }
}
