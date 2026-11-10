package az.jeparla.merchant.dto;

import az.jeparla.product.StoneOrigin;
import az.jeparla.product.StoneType;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Stones of a product ({@code stoneSchema} in frontend/src/lib/merchant/schemas.ts): {@code count} identical
 * stones, carat per stone. A certificate number needs its lab. FASHION products take only cubic zirconia,
 * without a certificate (#128).
 */
public record StoneRequest(
        @NotNull StoneType type,
        StoneOrigin origin,
        @Size(max = 20) String shape,
        @Positive @Digits(integer = 3, fraction = 3) BigDecimal carat,
        @NotNull @Min(1) @Max(999) Integer count,
        @Size(max = 20) String color,
        @Size(max = 20) String clarity,
        @Size(max = 20) String cut,
        @Size(max = 40) String certificateLab,
        @Size(max = 60) String certificateNumber) {
}
