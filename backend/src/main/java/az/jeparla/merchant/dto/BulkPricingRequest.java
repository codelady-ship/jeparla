package az.jeparla.merchant.dto;

import az.jeparla.product.PricingMode;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * {@code POST /api/v1/merchant/products/bulk-pricing} (#109): change the price mode and/or the labour cost per gram
 * of up to {@value BulkStatusRequest#MAX_IDS} of the seller's own products, each product on its own.
 *
 * @param pricingMode  FIXED (each variant keeps its current price as a fixed one) or METAL_LINKED (needs
 *                     {@code laborPerGram}); null leaves the mode as it is
 * @param laborPerGram labour per gram in AZN, at most 2 decimals; alone it changes only METAL_LINKED variants
 */
public record BulkPricingRequest(
        @NotEmpty @Size(max = BulkStatusRequest.MAX_IDS) List<@NotNull @Positive Long> ids,
        PricingMode pricingMode,
        @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal laborPerGram) {
}
