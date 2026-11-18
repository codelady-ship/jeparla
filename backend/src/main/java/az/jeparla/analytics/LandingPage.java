package az.jeparla.analytics;

import java.util.Locale;

/**
 * Kind of page an AI visitor landed on (#62): enough to see whether assistants cite products, stores or the price
 * page, without storing any URL. CHECK {@code ai_referral_counts_page} (V62) lists the same names.
 */
public enum LandingPage {
    HOME,
    PRODUCT,
    STORE,
    CATEGORY,
    PRICES,
    GUIDE,
    OTHER;

    /** The page kind the frontend names ({@code product}, {@code store} ...); unknown or missing is OTHER. */
    public static LandingPage parse(String value) {
        if (value == null || value.isBlank() || value.length() > 32) {
            return OTHER;
        }
        try {
            return valueOf(value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            return OTHER;
        }
    }
}
