package az.jeparla.product.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.product.ProductVariant;
import io.swagger.v3.oas.annotations.media.Schema;

/** METAL_LINKED inputs of a variant (PLAN 5.10, {@code PricingRule} in frontend/src/types/api.ts). */
@Schema(name = "PricingRule", requiredProperties = {"laborPerGram", "laborFixed", "stonePrice", "markupPercent",
        "minPrice", "maxPrice"})
public record PricingRuleDto(
        @Schema(example = "12.00") String laborPerGram,
        @Schema(example = "20.00") String laborFixed,
        @Schema(example = "0.00") String stonePrice,
        @Schema(example = "15.00") String markupPercent,
        @Schema(nullable = true) String minPrice,
        @Schema(nullable = true) String maxPrice) {

    public static PricingRuleDto of(ProductVariant variant) {
        return new PricingRuleDto(Decimal.of(variant.getLaborPerGram()), Decimal.of(variant.getLaborFixed()),
                Decimal.of(variant.getStonePrice()), Decimal.of(variant.getMarkupPercent()),
                Decimal.of(variant.getMinPrice()), Decimal.of(variant.getMaxPrice()));
    }
}
