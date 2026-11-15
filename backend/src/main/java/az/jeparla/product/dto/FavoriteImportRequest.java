package az.jeparla.product.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * The guest's saved list (localStorage) merged into the account after sign-in (PLAN 5.11). Up to 100 product ids;
 * unknown, hidden or already saved ones are skipped, so the call can be repeated.
 *
 * @param productIds the saved product ids
 * @param prices     optional: the price each product had when the guest saved it in the browser (#112), so the
 *                   "since you added it" change survives the sign-in; products without one get today's price
 */
@Schema(name = "FavoriteImportRequest", requiredProperties = {"productIds"})
public record FavoriteImportRequest(
        @NotNull @Size(max = 100) List<@NotNull @Positive Long> productIds,
        @Size(max = 100) List<@NotNull @Valid SavedPrice> prices) {

    /**
     * A price the browser remembered for one product.
     *
     * @param amount   decimal string, at most 10 integer digits and 2 decimals (NUMERIC(12,2))
     * @param currency ISO 4217 code
     * @param savedAt  when it was saved; a time in the future is taken as now
     */
    @Schema(name = "FavoriteSavedPrice", requiredProperties = {"productId", "amount", "currency", "savedAt"})
    public record SavedPrice(
            @NotNull @Positive Long productId,
            @NotNull @Pattern(regexp = "^\\d{1,10}(\\.\\d{1,2})?$") String amount,
            @NotNull @Pattern(regexp = "^[A-Z]{3}$") String currency,
            @NotNull Instant savedAt) {
    }
}
