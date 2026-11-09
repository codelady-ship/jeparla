package az.jeparla.common.dto;

import java.math.BigDecimal;

/**
 * Decimal values in responses are strings ({@code Decimal} in frontend/src/types/api.ts): the
 * plain notation of the {@code BigDecimal} with its column scale ("3.250", "1248.50"), never
 * scientific notation and never a JSON number.
 */
public final class Decimal {

    private Decimal() {
    }

    public static String of(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }
}
