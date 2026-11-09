package az.jeparla.pricing.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.pricing.MetalPriceSnapshot;
import az.jeparla.pricing.QuoteSource;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A daily metal quote ({@code MetalPrice} in frontend/src/types/api.ts): AZN per troy ounce and per
 * gram (ounce / 31.1034768), as decimal strings.
 *
 * @param date business date of the quote; weekends and holidays keep the last available date
 */
@Schema(name = "MetalPrice", requiredProperties = {"metal", "date", "pricePerOunce", "pricePerGram", "currency",
        "source", "fetchedAt"})
public record MetalPriceDto(
        Metal metal,
        @Schema(format = "date", example = "2026-11-03") String date,
        @Schema(example = "7000.0000") String pricePerOunce,
        @Schema(example = "225.0565") String pricePerGram,
        @Schema(example = "AZN") String currency,
        @Schema(description = "CBAR, or ADMIN for a manual override (#43)") QuoteSource source,
        @Schema(format = "date-time") String fetchedAt) {

    public static MetalPriceDto of(MetalPriceSnapshot snapshot) {
        return new MetalPriceDto(snapshot.getMetal(), snapshot.getQuoteDate().toString(),
                Decimal.of(snapshot.getPricePerOunce()), Decimal.of(snapshot.getPricePerGram()),
                snapshot.getCurrency().getCurrencyCode(), snapshot.getSource(), snapshot.getFetchedAt().toString());
    }
}
