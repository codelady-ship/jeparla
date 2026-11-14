package az.jeparla.product.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * The guest's saved list (localStorage) merged into the account after sign-in (PLAN 5.11). Up to 100 product ids;
 * unknown, hidden or already saved ones are skipped, so the call can be repeated.
 */
@Schema(name = "FavoriteImportRequest", requiredProperties = {"productIds"})
public record FavoriteImportRequest(@NotNull @Size(max = 100) List<@NotNull @Positive Long> productIds) {
}
