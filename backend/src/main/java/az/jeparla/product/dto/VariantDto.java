package az.jeparla.product.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.PricingMode;
import az.jeparla.product.ProductVariant;
import az.jeparla.product.StockStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A sellable variant ({@code Variant} in frontend/src/types/api.ts). {@code pricing} is set only for
 * METAL_LINKED variants. A FASHION variant (#128) has no fineness and maybe no weight.
 * {@code priceBreakdown} (#104) is how the price is made up, with only the parts the data holds.
 */
@Schema(name = "Variant", requiredProperties = {"id", "sku", "fineness", "weightGrams", "size", "price",
        "pricingMode", "pricing", "stockStatus", "priceUpdatedAt", "priceBreakdown"})
public record VariantDto(
        long id,
        String sku,
        @Schema(nullable = true) FinenessDto fineness,
        @Schema(nullable = true, example = "3.250") String weightGrams,
        @Schema(nullable = true, example = "17") String size,
        MoneyDto price,
        PricingMode pricingMode,
        @Schema(nullable = true) PricingRuleDto pricing,
        StockStatus stockStatus,
        @Schema(format = "date-time") String priceUpdatedAt,
        PriceBreakdownDto priceBreakdown) {

    public static VariantDto of(ProductVariant variant) {
        return new VariantDto(variant.getId(), variant.getSku(), variant.getFineness() == null ? null : FinenessDto.of(variant.getFineness()),
                Decimal.of(variant.getWeightGrams()), variant.getSize(),
                MoneyDto.of(variant.getPrice(), variant.getCurrency()), variant.getPricingMode(),
                variant.getPricingMode() == PricingMode.METAL_LINKED ? PricingRuleDto.of(variant) : null,
                variant.getStockStatus(), variant.getPriceUpdatedAt().toString(), PriceBreakdownDto.of(variant));
    }
}
