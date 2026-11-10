package az.jeparla.merchant.dto;

import az.jeparla.product.PricingMode;
import az.jeparla.product.StockStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * A variant as the seller sends it (PLAN 5.2, 5.10).
 *
 * @param id          an existing variant to change (product PUT); null adds a new one
 * @param sku         unique in the store among live variants; generated when empty
 * @param finenessId  required for PRECIOUS products (a fineness of the product metal), absent for FASHION
 * @param weightGrams required for PRECIOUS, optional for FASHION; at most 3 decimals
 * @param pricingMode FIXED (default) or METAL_LINKED (PRECIOUS only)
 * @param price       required for FIXED, ignored for METAL_LINKED (computed from the metal price)
 * @param rule        required for METAL_LINKED
 */
public record VariantRequest(
        @Positive Long id,
        @Size(max = 64) @Pattern(regexp = "^$|^[\\p{L}\\p{N}][\\p{L}\\p{N}._/-]*$") String sku,
        @Positive Long finenessId,
        @Positive @DecimalMax("10000") @Digits(integer = 5, fraction = 3) BigDecimal weightGrams,
        @Size(max = 20) String size,
        PricingMode pricingMode,
        @Positive @Digits(integer = 10, fraction = 2) BigDecimal price,
        @Valid PricingRuleRequest rule,
        @NotNull StockStatus stockStatus) {

    public PricingMode mode() {
        return pricingMode == null ? PricingMode.FIXED : pricingMode;
    }
}
