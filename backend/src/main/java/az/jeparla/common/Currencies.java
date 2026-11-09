package az.jeparla.common;

import java.util.Currency;

/** Currencies used by Jeparla. Prices are stored with an ISO 4217 code ({@code CHAR(3)}). */
public final class Currencies {

    /** Azerbaijani manat: the default currency of prices and CBAR quotes. */
    public static final Currency AZN = Currency.getInstance("AZN");

    private Currencies() {
    }
}
