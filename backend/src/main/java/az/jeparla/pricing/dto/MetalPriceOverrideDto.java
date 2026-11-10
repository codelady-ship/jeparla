package az.jeparla.pricing.dto;

import az.jeparla.pricing.QuoteSource;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The override now in use.
 *
 * @param date      the business date it is stored under (today in Asia/Baku)
 * @param change    percent change against the price it replaced, one decimal
 * @param repricing {@code DONE} or {@code DEFERRED} (see {@link QuoteDecisionDto})
 */
@Schema(name = "MetalPriceOverrideResult", requiredProperties = {"metal", "date", "pricePerOunce", "pricePerGram",
        "change", "source", "note", "repricing"})
public record MetalPriceOverrideDto(Metal metal, @Schema(format = "date") String date, String pricePerOunce,
        String pricePerGram, String change, QuoteSource source, String note,
        @Schema(allowableValues = {"DONE", "DEFERRED"}) String repricing) {
}
