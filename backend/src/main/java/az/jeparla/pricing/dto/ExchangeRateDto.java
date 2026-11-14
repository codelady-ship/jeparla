package az.jeparla.pricing.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.pricing.ExchangeRate;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A CBAR display rate ({@code ExchangeRate} in frontend/src/types/api.ts): AZN per one unit of
 * {@code currency}, as a decimal string. Prices are in AZN; a price shown in USD or EUR is approximate (#53).
 *
 * @param date CBAR bulletin date of the rate
 */
@Schema(name = "ExchangeRate", requiredProperties = {"currency", "date", "aznPerUnit", "fetchedAt"})
public record ExchangeRateDto(
        @Schema(example = "USD", allowableValues = {"USD", "EUR"}) String currency,
        @Schema(format = "date", example = "2026-11-06") String date,
        @Schema(example = "1.700000") String aznPerUnit,
        @Schema(format = "date-time") String fetchedAt) {

    public static ExchangeRateDto of(ExchangeRate rate) {
        return new ExchangeRateDto(rate.getCurrency(), rate.getRateDate().toString(),
                Decimal.of(rate.getAznPerUnit()), rate.getFetchedAt().toString());
    }
}
