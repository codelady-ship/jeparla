package az.jeparla.pricing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Manual override of the price in use ({@code overrideSchema} in frontend/src/lib/admin/settings.ts).
 *
 * @param pricePerOunce AZN per troy ounce, at most 7 integer digits and 2 decimals; a decimal comma is
 *                      accepted
 * @param reason        why, for the audit log (10-500 characters)
 * @param confirmLarge  the admin checked the source of a change above the sanity limit
 */
@Schema(name = "MetalPriceOverride")
public record MetalPriceOverrideRequest(
        @NotNull @Pattern(regexp = "\\s*\\d{1,7}([.,]\\d{1,2})?\\s*") @Schema(example = "7000.00") String pricePerOunce,
        @NotNull @Size(max = 500) String reason,
        Boolean confirmLarge) {
}
