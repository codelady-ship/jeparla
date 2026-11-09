package az.jeparla.common.persistence;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Brings a decimal to the scale of its column, so the entity holds the same value the database
 * stores ({@code 1248.5} becomes {@code 1248.50}). More decimals than the column has is a bug in
 * the caller, never a silent rounding: it throws {@link ArithmeticException}.
 */
public final class Decimals {

    /** Money: {@code NUMERIC(12,2)}. */
    public static final int MONEY_SCALE = 2;
    /** Weight in grams and carat: {@code NUMERIC(8,3)}. */
    public static final int WEIGHT_SCALE = 3;
    /** Percent: {@code NUMERIC(5,2)} / {@code NUMERIC(7,2)}. */
    public static final int PERCENT_SCALE = 2;
    /** CBAR quote per ounce and per gram: {@code NUMERIC(14,4)}. */
    public static final int QUOTE_SCALE = 4;

    public static final BigDecimal ZERO_MONEY = BigDecimal.ZERO.setScale(MONEY_SCALE);

    private Decimals() {
    }

    public static BigDecimal money(BigDecimal value) {
        return scaled(value, MONEY_SCALE);
    }

    public static BigDecimal weight(BigDecimal value) {
        return scaled(value, WEIGHT_SCALE);
    }

    public static BigDecimal percent(BigDecimal value) {
        return scaled(value, PERCENT_SCALE);
    }

    public static BigDecimal quote(BigDecimal value) {
        return scaled(value, QUOTE_SCALE);
    }

    private static BigDecimal scaled(BigDecimal value, int scale) {
        return value == null ? null : value.setScale(scale, RoundingMode.UNNECESSARY);
    }
}
