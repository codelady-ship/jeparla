package az.jeparla.pricing.dto;

import az.jeparla.pricing.QuoteSource;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The price in use of one metal for the admin panel ({@code AdminMetalPrice} in
 * frontend/src/types/admin.ts).
 *
 * @param previousPerOunce the applied quote before the one in use (the same when there is none)
 * @param change           percent change from the previous quote, one decimal
 * @param held             the newest quote held by the sanity check, if it is newer than the one in use
 */
@Schema(name = "AdminMetalPrice", requiredProperties = {"metal", "date", "pricePerOunce", "pricePerGram",
        "previousPerOunce", "change", "source", "held"})
public record AdminMetalPriceDto(
        Metal metal,
        @Schema(format = "date") String date,
        String pricePerOunce,
        String pricePerGram,
        String previousPerOunce,
        @Schema(example = "-1.2") String change,
        QuoteSource source,
        @Schema(nullable = true) HeldQuoteDto held) {

    /** {@code HeldQuote}: a CBAR quote that moved more than the sanity limit and waits for an admin. */
    @Schema(name = "HeldQuote", requiredProperties = {"date", "pricePerOunce", "change", "status"})
    public record HeldQuoteDto(
            @Schema(format = "date") String date,
            String pricePerOunce,
            @Schema(description = "Percent change against the price in use, one decimal", example = "12.4") String change,
            @Schema(allowableValues = {"HELD", "APPLIED", "DISCARDED"}) String status) {
    }
}
