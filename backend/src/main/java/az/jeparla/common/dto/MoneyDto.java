package az.jeparla.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.Currency;

/**
 * Money as a decimal string and an ISO 4217 code ({@code Money} in frontend/src/types/api.ts), e.g.
 * {@code {"amount": "1248.50", "currency": "AZN"}}. Never a JSON number, so no float on either side.
 */
@Schema(name = "Money", requiredProperties = {"amount", "currency"})
public record MoneyDto(
        @Schema(description = "Decimal string with the column scale", example = "1248.50") String amount,
        @Schema(allowableValues = {"AZN", "USD", "EUR"}, example = "AZN") String currency) {

    public static MoneyDto of(BigDecimal amount, Currency currency) {
        return new MoneyDto(Decimal.of(amount), currency.getCurrencyCode());
    }
}
