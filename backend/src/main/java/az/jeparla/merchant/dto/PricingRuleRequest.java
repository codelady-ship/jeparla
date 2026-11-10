package az.jeparla.merchant.dto;

import az.jeparla.pricing.PricingEngine;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/**
 * METAL_LINKED inputs (PLAN 5.10): labor per gram and fixed, stone price, markup percent, optional minimum
 * and maximum. Money fits {@code NUMERIC(12,2)}, the markup {@code NUMERIC(5,2)}: more decimals are a 400,
 * never a silent rounding (#125).
 */
public record PricingRuleRequest(
        @NotNull @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal laborPerGram,
        @NotNull @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal laborFixed,
        @NotNull @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal stonePrice,
        @NotNull @PositiveOrZero @Digits(integer = 3, fraction = 2) BigDecimal markupPercent,
        @Positive @Digits(integer = 10, fraction = 2) BigDecimal minPrice,
        @Positive @Digits(integer = 10, fraction = 2) BigDecimal maxPrice) {

    public PricingEngine.Rule toRule() {
        return new PricingEngine.Rule(laborPerGram, laborFixed, stonePrice, markupPercent, minPrice, maxPrice);
    }
}
