package az.jeparla.pricing.cbar;

import az.jeparla.product.Metal;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * The bank metals of one CBAR daily bulletin.
 *
 * @param date         business date of the bulletin ({@code ValCurs/@Date}). On a weekend or holiday
 *                     CBAR answers with the last bulletin, so this is earlier than the date asked for.
 * @param ouncePrices  AZN per troy ounce of all four metals, as published (up to 4 decimals)
 */
public record CbarBulletin(LocalDate date, Map<Metal, BigDecimal> ouncePrices) {

    public CbarBulletin {
        Objects.requireNonNull(date, "date");
        EnumMap<Metal, BigDecimal> copy = new EnumMap<>(Metal.class);
        copy.putAll(ouncePrices);
        if (copy.size() != Metal.values().length) {
            throw new IllegalArgumentException("A bulletin needs all metals, got " + copy.keySet());
        }
        ouncePrices = Collections.unmodifiableMap(copy);
    }
}
