package az.jeparla.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * METAL_LINKED price (PLAN 5.10, #44): the same arithmetic as {@code frontend/src/lib/pricing.ts}
 * (big.js), so the seller's preview and the catalog price never differ by a cent.
 *
 * <pre>
 *   metal  = weight x (fineness / 1000) x gram price of pure metal
 *   labor  = weight x laborPerGram + laborFixed
 *   price  = (metal + labor + stone) x (1 + markup / 100)
 * </pre>
 *
 * then clamped to the seller's minimum, then maximum, and rounded to 0.01 half up (away from zero,
 * big.js {@code roundHalfUp}). Every step before the final rounding is exact: the inputs are
 * decimals with at most 4 places and the only divisions are by 1000 and 100. Parity with the
 * frontend is tested against values produced by pricing.ts itself
 * ({@code src/test/resources/pricing/}).
 *
 * <p>BigDecimal only (CLAUDE.md): no float or double anywhere.
 */
public final class PricingEngine {

    /** 1 troy ounce in grams (CBAR quotes metals per troy ounce). */
    public static final BigDecimal TROY_OUNCE_GRAMS = new BigDecimal("31.1034768");

    /** big.js default {@code Big.DP}: decimal places of a non-terminating division. */
    static final int BIG_JS_DIVISION_SCALE = 20;

    /** Largest price {@code NUMERIC(12,2)} holds. */
    static final BigDecimal MAX_PRICE = new BigDecimal("9999999999.99");

    private static final BigDecimal THOUSAND = BigDecimal.valueOf(1000);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private PricingEngine() {
    }

    /** Which limit of the seller decided the price. */
    public enum Clamp {
        MIN,
        MAX
    }

    /**
     * The seller's METAL_LINKED rule ({@code PricingRule} in frontend/src/types/api.ts). Limits are
     * optional.
     */
    public record Rule(BigDecimal laborPerGram, BigDecimal laborFixed, BigDecimal stonePrice,
            BigDecimal markupPercent, BigDecimal minPrice, BigDecimal maxPrice) {

        public Rule {
            requireNonNegative(laborPerGram, "laborPerGram");
            requireNonNegative(laborFixed, "laborFixed");
            requireNonNegative(stonePrice, "stonePrice");
            requireNonNegative(markupPercent, "markupPercent");
            if (minPrice != null) {
                requireNonNegative(minPrice, "minPrice");
            }
            if (maxPrice != null) {
                requireNonNegative(maxPrice, "maxPrice");
            }
            if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
                throw new IllegalArgumentException("minPrice " + minPrice + " is above maxPrice " + maxPrice);
            }
        }

        /** No labor, stone, markup or limits: the metal value only. */
        public static Rule metalOnly() {
            return new Rule(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, null);
        }
    }

    /**
     * The parts behind a price ({@code PriceBreakdown} in pricing.ts). The parts are rounded to cents
     * for display only; the total is computed from the unrounded values.
     */
    public record Breakdown(BigDecimal metal, BigDecimal labor, BigDecimal stone, BigDecimal markup, Clamp clamped,
            BigDecimal total) {
    }

    /** AZN per troy ounce to AZN per gram, 4 decimals ({@code gramPrice} in pricing.ts). */
    public static BigDecimal gramPrice(BigDecimal pricePerOunce) {
        requirePositive(pricePerOunce, "pricePerOunce");
        return pricePerOunce.divide(TROY_OUNCE_GRAMS, BIG_JS_DIVISION_SCALE, RoundingMode.HALF_UP)
                .setScale(4, RoundingMode.HALF_UP);
    }

    /** Percent change from {@code from} to {@code to}, one decimal ({@code percentChange} in pricing.ts). */
    public static BigDecimal percentChange(BigDecimal from, BigDecimal to) {
        Objects.requireNonNull(from, "from");
        Objects.requireNonNull(to, "to");
        if (from.signum() == 0) {
            return new BigDecimal("0.0");
        }
        return to.subtract(from).divide(from, BIG_JS_DIVISION_SCALE, RoundingMode.HALF_UP).multiply(HUNDRED)
                .setScale(1, RoundingMode.HALF_UP);
    }

    /** The METAL_LINKED price, rounded to cents ({@code metalLinkedPrice} in pricing.ts). */
    public static BigDecimal price(BigDecimal weightGrams, int fineness, BigDecimal pureGramPrice, Rule rule) {
        return breakdown(weightGrams, fineness, pureGramPrice, rule).total();
    }

    /** {@code metalLinkedBreakdown} in pricing.ts. */
    public static Breakdown breakdown(BigDecimal weightGrams, int fineness, BigDecimal pureGramPrice, Rule rule) {
        requirePositive(weightGrams, "weightGrams");
        requirePositive(pureGramPrice, "pureGramPrice");
        Objects.requireNonNull(rule, "rule");
        if (fineness <= 0 || fineness > 1000) {
            throw new IllegalArgumentException("fineness must be 1..1000, got " + fineness);
        }

        BigDecimal metal = weightGrams.multiply(BigDecimal.valueOf(fineness)).divide(THOUSAND).multiply(pureGramPrice);
        BigDecimal labor = weightGrams.multiply(rule.laborPerGram()).add(rule.laborFixed());
        BigDecimal base = metal.add(labor).add(rule.stonePrice());
        BigDecimal raw = base.multiply(HUNDRED.add(rule.markupPercent()).divide(HUNDRED));

        BigDecimal price = raw;
        Clamp clamped = null;
        if (rule.minPrice() != null && price.compareTo(rule.minPrice()) < 0) {
            price = rule.minPrice();
            clamped = Clamp.MIN;
        }
        if (rule.maxPrice() != null && price.compareTo(rule.maxPrice()) > 0) {
            price = rule.maxPrice();
            clamped = Clamp.MAX;
        }
        BigDecimal total = cents(price);
        if (total.compareTo(MAX_PRICE) > 0) {
            throw new ArithmeticException("price " + total + " does not fit NUMERIC(12,2)");
        }
        return new Breakdown(cents(metal), cents(labor), cents(rule.stonePrice()), cents(raw.subtract(base)), clamped,
                total);
    }

    private static BigDecimal cents(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static void requirePositive(BigDecimal value, String name) {
        Objects.requireNonNull(value, name);
        if (value.signum() <= 0) {
            throw new IllegalArgumentException(name + " must be positive, got " + value);
        }
    }

    private static void requireNonNegative(BigDecimal value, String name) {
        Objects.requireNonNull(value, name);
        if (value.signum() < 0) {
            throw new IllegalArgumentException(name + " must not be negative, got " + value);
        }
    }
}
