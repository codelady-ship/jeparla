package az.jeparla.admin.dto;

import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Create or replace a fineness (#40). Unique per metal and value (409 {@code admin.fineness_exists}). Metal and
 * value change only while no variant uses the fineness (409 {@code admin.fineness_in_use}): the metal-linked price
 * of every variant depends on them.
 *
 * @param value     parts per thousand, 1-1000
 * @param sortOrder position in lists (default 0)
 * @param active    offered in the seller form and the catalog filter (default true)
 */
@Schema(name = "FinenessRequest", requiredProperties = {"metal", "value", "label"})
public record FinenessRequest(
        @NotNull Metal metal,
        @NotNull @Min(1) @Max(1000) Integer value,
        @NotBlank @Size(max = 40) String label,
        @Min(0) @Max(100_000) Integer sortOrder,
        Boolean active) {
}
