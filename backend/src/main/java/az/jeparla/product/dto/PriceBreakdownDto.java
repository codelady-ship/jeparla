package az.jeparla.product.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.pricing.MetalPriceSnapshot;
import az.jeparla.pricing.PricingEngine;
import az.jeparla.pricing.QuoteSource;
import az.jeparla.product.PricingMode;
import az.jeparla.product.Product;
import az.jeparla.product.ProductVariant;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;

/**
 * How the price of a variant is made up (#104, "Qiymət necə hesablanıb"). Only what is in the data: a
 * component the seller did not enter, or one that cannot be recomputed, is {@code null}, never a guess.
 *
 * <ul>
 *   <li><b>METAL_LINKED</b> with the quote it was priced from: {@link PricingEngine#breakdown} over the
 *       variant's weight, fineness and rule and that quote's gram price, so the parts come from the same
 *       function as the price (#44) and are rounded the same way (0.01, half up). When the recomputed total
 *       differs from the stored price (it never should), every component is {@code null}.</li>
 *   <li><b>FIXED</b> (or METAL_LINKED without a quote): the total only.</li>
 * </ul>
 *
 * The parts are rounded each for display; with a {@code clamped} price (the seller's minimum or maximum) or
 * cent rounding their sum may differ from {@code total}. {@code total} is always the variant's price.
 *
 * @param total        the variant's price (the same value as {@code Variant.price} and the JSON-LD offer)
 * @param metal        metal value at the quote; null for FIXED
 * @param labor        workmanship as the seller entered it; null for FIXED or when both labor inputs are 0
 * @param stone        the seller's stone price (no official source exists); null for FIXED or when 0
 * @param markup       the seller's markup (store share); null for FIXED or when 0
 * @param clamped      MIN or MAX when the seller's limit decided the price; null otherwise
 * @param pricePerGram total / weight, 0.01 half up; plain arithmetic, not a judgement; null without a weight
 * @param laborSeparate the store's choice (#104, V45): labor and markup as two lines; false (default) shows
 *                      them as one line "labor and store share"; always false without the parts
 */
@Schema(name = "PriceBreakdown", requiredProperties = {"total", "metal", "labor", "stone", "markup", "clamped",
        "pricePerGram", "laborSeparate"})
public record PriceBreakdownDto(
        MoneyDto total,
        @Schema(nullable = true) MetalValue metal,
        @Schema(nullable = true) Labor labor,
        @Schema(nullable = true) MoneyDto stone,
        @Schema(nullable = true) Markup markup,
        @Schema(nullable = true) PricingEngine.Clamp clamped,
        @Schema(nullable = true) MoneyDto pricePerGram,
        @Schema(description = "The store shows labor and markup as two lines (#104); false: one line")
        boolean laborSeparate) {

    /**
     * Metal value = weight x fineness / 1000 x gram price of the pure metal.
     *
     * @param gramPrice  AZN per gram of pure metal of the quote, 4 decimals
     * @param quoteDate  business date of the quote (ISO date)
     * @param source     CBAR (the official daily price) or ADMIN (an admin corrected it that day)
     */
    @Schema(name = "PriceBreakdownMetal", requiredProperties = {"value", "weightGrams", "fineness", "gramPrice",
            "quoteDate", "source"})
    public record MetalValue(MoneyDto value, @Schema(example = "3.250") String weightGrams, int fineness,
            MoneyDto gramPrice, @Schema(format = "date") String quoteDate,
            QuoteSource source) {
    }

    /**
     * Workmanship: {@code weight x perGram + fixed}.
     *
     * @param perGram labor per gram; null when the seller entered 0
     * @param fixed   fixed labor; null when the seller entered 0
     */
    @Schema(name = "PriceBreakdownLabor", requiredProperties = {"amount", "perGram", "fixed"})
    public record Labor(MoneyDto amount, @Schema(nullable = true) MoneyDto perGram,
            @Schema(nullable = true) MoneyDto fixed) {
    }

    /** The seller's markup on metal + labor + stone. */
    @Schema(name = "PriceBreakdownMarkup", requiredProperties = {"percent", "amount"})
    public record Markup(@Schema(example = "15.00") String percent, MoneyDto amount) {
    }

    public static PriceBreakdownDto of(ProductVariant variant) {
        Currency currency = variant.getCurrency();
        MoneyDto total = MoneyDto.of(variant.getPrice(), currency);
        MoneyDto perGram = perGram(variant);
        MetalPriceSnapshot quote = variant.getMetalSnapshot();
        if (variant.getPricingMode() != PricingMode.METAL_LINKED || quote == null || variant.getFineness() == null
                || variant.getWeightGrams() == null || !currency.equals(quote.getCurrency())) {
            return new PriceBreakdownDto(total, null, null, null, null, null, perGram, false);
        }
        PricingEngine.Breakdown parts;
        try {
            parts = PricingEngine.breakdown(variant.getWeightGrams(), variant.getFineness().getValue(),
                    quote.getPricePerGram(), new PricingEngine.Rule(variant.getLaborPerGram(), variant.getLaborFixed(),
                            variant.getStonePrice(), variant.getMarkupPercent(), variant.getMinPrice(),
                            variant.getMaxPrice()));
        } catch (RuntimeException e) {
            return new PriceBreakdownDto(total, null, null, null, null, null, perGram, false);
        }
        if (parts.total().compareTo(variant.getPrice()) != 0) {
            return new PriceBreakdownDto(total, null, null, null, null, null, perGram, false);
        }
        MetalValue metal = new MetalValue(MoneyDto.of(parts.metal(), currency), Decimal.of(variant.getWeightGrams()),
                variant.getFineness().getValue(), MoneyDto.of(quote.getPricePerGram(), currency),
                quote.getQuoteDate().toString(), quote.getSource());
        boolean anyLabor = variant.getLaborPerGram().signum() > 0 || variant.getLaborFixed().signum() > 0;
        Labor labor = anyLabor
                ? new Labor(MoneyDto.of(parts.labor(), currency), positive(variant.getLaborPerGram(), currency),
                        positive(variant.getLaborFixed(), currency))
                : null;
        Markup markup = variant.getMarkupPercent().signum() > 0
                ? new Markup(Decimal.of(variant.getMarkupPercent()), MoneyDto.of(parts.markup(), currency))
                : null;
        return new PriceBreakdownDto(total, metal, labor, positive(variant.getStonePrice(), currency), markup,
                parts.clamped(), perGram, laborSeparate(variant));
    }

    /** The store's #104 choice; false for a variant not attached to a stored product. */
    static boolean laborSeparate(ProductVariant variant) {
        Product product = variant.getProduct();
        return product != null && product.getStore() != null && product.getStore().isSplitLaborMarkup();
    }

    private static MoneyDto perGram(ProductVariant variant) {
        BigDecimal weight = variant.getWeightGrams();
        if (weight == null || weight.signum() <= 0) {
            return null;
        }
        return MoneyDto.of(variant.getPrice().divide(weight, 2, RoundingMode.HALF_UP), variant.getCurrency());
    }

    private static MoneyDto positive(BigDecimal value, Currency currency) {
        return value != null && value.signum() > 0 ? MoneyDto.of(value, currency) : null;
    }
}
