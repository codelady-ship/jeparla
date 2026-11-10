package az.jeparla.merchant.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.ProductVariant;
import az.jeparla.product.StockStatus;
import az.jeparla.product.dto.PricingRuleDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * A variant in the merchant cabinet. {@code price} is the current price: the seller's for FIXED, computed
 * from the metal price in use for METAL_LINKED ({@code metalQuoteId} names that quote).
 */
@Schema(name = "MerchantVariant")
public record MerchantVariantDto(
        long id,
        String sku,
        @Schema(nullable = true) Long finenessId,
        @Schema(nullable = true) Metal metal,
        @Schema(nullable = true) Integer fineness,
        @Schema(nullable = true, example = "3.250") String weightGrams,
        @Schema(nullable = true) String size,
        MoneyDto price,
        PricingMode pricingMode,
        @Schema(nullable = true) PricingRuleDto rule,
        @Schema(nullable = true) Long metalQuoteId,
        StockStatus stockStatus,
        Instant priceUpdatedAt) {

    public static MerchantVariantDto of(ProductVariant variant) {
        boolean linked = variant.getPricingMode() == PricingMode.METAL_LINKED;
        var fineness = variant.getFineness();
        return new MerchantVariantDto(variant.getId(), variant.getSku(),
                fineness == null ? null : fineness.getId(),
                fineness == null ? null : fineness.getMetal(),
                fineness == null ? null : fineness.getValue(),
                Decimal.of(variant.getWeightGrams()), variant.getSize(),
                MoneyDto.of(variant.getPrice(), variant.getCurrency()), variant.getPricingMode(),
                linked ? PricingRuleDto.of(variant) : null,
                linked && variant.getMetalSnapshot() != null ? variant.getMetalSnapshot().getId() : null,
                variant.getStockStatus(), variant.getPriceUpdatedAt());
    }
}
