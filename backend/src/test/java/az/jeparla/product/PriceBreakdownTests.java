package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.common.Currencies;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.pricing.MetalPriceSnapshot;
import az.jeparla.pricing.PricingEngine;
import az.jeparla.pricing.QuoteSource;
import az.jeparla.product.dto.PriceBreakdownDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** {@link PriceBreakdownDto} (#104): only the parts the data holds, from the same engine as the price. */
class PriceBreakdownTests {

    private static final Instant NOW = Instant.parse("2026-11-10T08:00:00Z");
    private static final Fineness GOLD_585 = new Fineness(Metal.GOLD, 585, "585", 1);
    private static final MetalPriceSnapshot QUOTE = new MetalPriceSnapshot(Metal.GOLD, LocalDate.of(2026, 11, 10),
            new BigDecimal("6877.4350"), new BigDecimal("221.1147"), QuoteSource.CBAR, NOW);

    private static BigDecimal d(String value) {
        return new BigDecimal(value);
    }

    private static ProductVariant metalLinked(String weight, String perGram, String fixed, String stone, String markup,
            String min, String max) {
        ProductVariant variant = new ProductVariant("SKU-1", GOLD_585, d(weight), BigDecimal.ONE, Currencies.AZN, NOW);
        variant.setMetalLinkedRule(d(perGram), d(fixed), d(stone), d(markup), min == null ? null : d(min),
                max == null ? null : d(max));
        BigDecimal price = PricingEngine.price(variant.getWeightGrams(), 585, QUOTE.getPricePerGram(),
                new PricingEngine.Rule(variant.getLaborPerGram(), variant.getLaborFixed(), variant.getStonePrice(),
                        variant.getMarkupPercent(), variant.getMinPrice(), variant.getMaxPrice()));
        variant.applyMetalPrice(price, QUOTE, NOW);
        return variant;
    }

    private static MoneyDto azn(String amount) {
        return new MoneyDto(amount, "AZN");
    }

    @Test
    void metalLinkedShowsEveryPartTheSellerEntered() {
        // metal 3.250 x 0.585 x 221.1147 = 420.394323..., labor 3.25 x 12 + 20 = 59, stone 250,
        // base 729.394323..., markup 15 % = 109.409148..., price 838.803471... -> 838.80
        ProductVariant variant = metalLinked("3.250", "12.00", "20.00", "250.00", "15.00", null, null);

        PriceBreakdownDto breakdown = PriceBreakdownDto.of(variant);

        assertThat(breakdown.total()).isEqualTo(azn("838.80"));
        assertThat(breakdown.total().amount()).isEqualTo(variant.getPrice().toPlainString());
        assertThat(breakdown.metal().value()).isEqualTo(azn("420.39"));
        assertThat(breakdown.metal().weightGrams()).isEqualTo("3.250");
        assertThat(breakdown.metal().fineness()).isEqualTo(585);
        assertThat(breakdown.metal().gramPrice()).isEqualTo(azn("221.1147"));
        assertThat(breakdown.metal().quoteDate()).isEqualTo("2026-11-10");
        assertThat(breakdown.metal().source()).isEqualTo(QuoteSource.CBAR);
        assertThat(breakdown.labor().amount()).isEqualTo(azn("59.00"));
        assertThat(breakdown.labor().perGram()).isEqualTo(azn("12.00"));
        assertThat(breakdown.labor().fixed()).isEqualTo(azn("20.00"));
        assertThat(breakdown.stone()).isEqualTo(azn("250.00"));
        assertThat(breakdown.markup().percent()).isEqualTo("15.00");
        assertThat(breakdown.markup().amount()).isEqualTo(azn("109.41"));
        assertThat(breakdown.clamped()).isNull();
        // 838.80 / 3.250 = 258.092... -> 258.09
        assertThat(breakdown.pricePerGram()).isEqualTo(azn("258.09"));
    }

    @Test
    void partsTheSellerLeftAtZeroAreAbsentNotZero() {
        ProductVariant variant = metalLinked("2.000", "0", "15.00", "0", "0", null, null);

        PriceBreakdownDto breakdown = PriceBreakdownDto.of(variant);

        assertThat(breakdown.labor().perGram()).isNull();
        assertThat(breakdown.labor().fixed()).isEqualTo(azn("15.00"));
        assertThat(breakdown.labor().amount()).isEqualTo(azn("15.00"));
        assertThat(breakdown.stone()).isNull();
        assertThat(breakdown.markup()).isNull();
        // 2 x 0.585 x 221.1147 = 258.704199 + 15 = 273.704199 -> 273.70
        assertThat(breakdown.total()).isEqualTo(azn("273.70"));
        assertThat(breakdown.metal().value()).isEqualTo(azn("258.70"));

        ProductVariant metalOnly = metalLinked("2.000", "0", "0", "0", "0", null, null);
        assertThat(PriceBreakdownDto.of(metalOnly).labor()).isNull();
    }

    @Test
    void aClampedPriceSaysWhichLimitDecided() {
        ProductVariant variant = metalLinked("1.000", "0", "0", "0", "0", "500.00", null);

        PriceBreakdownDto breakdown = PriceBreakdownDto.of(variant);

        assertThat(breakdown.total()).isEqualTo(azn("500.00"));
        assertThat(breakdown.clamped()).isEqualTo(PricingEngine.Clamp.MIN);
        assertThat(breakdown.metal().value()).isEqualTo(azn("129.35"));
    }

    @Test
    void aFixedPriceHasOnlyItsTotal() {
        ProductVariant variant = new ProductVariant("SKU-2", GOLD_585, d("4.000"), d("990.00"), Currencies.AZN, NOW);

        PriceBreakdownDto breakdown = PriceBreakdownDto.of(variant);

        assertThat(breakdown.total()).isEqualTo(azn("990.00"));
        assertThat(breakdown.metal()).isNull();
        assertThat(breakdown.labor()).isNull();
        assertThat(breakdown.stone()).isNull();
        assertThat(breakdown.markup()).isNull();
        assertThat(breakdown.clamped()).isNull();
        assertThat(breakdown.pricePerGram()).isEqualTo(azn("247.50"));
    }

    @Test
    void noPartIsShownWhenTheyDoNotAddUpToTheStoredPrice() {
        ProductVariant unpriced = new ProductVariant("SKU-3", GOLD_585, d("3.000"), d("700.00"), Currencies.AZN, NOW);
        unpriced.setMetalLinkedRule(d("10"), d("0"), d("0"), d("0"), null, null);
        // METAL_LINKED but never priced from a quote.
        assertThat(PriceBreakdownDto.of(unpriced).metal()).isNull();
        assertThat(PriceBreakdownDto.of(unpriced).total()).isEqualTo(azn("700.00"));

        // Priced from the quote, then the stored price differs from what the quote gives.
        unpriced.applyMetalPrice(d("700.00"), QUOTE, NOW);
        PriceBreakdownDto stale = PriceBreakdownDto.of(unpriced);
        assertThat(stale.total()).isEqualTo(azn("700.00"));
        assertThat(stale.metal()).isNull();
        assertThat(stale.labor()).isNull();
    }

    @Test
    void anAdminCorrectedQuoteSaysSo() {
        MetalPriceSnapshot corrected = new MetalPriceSnapshot(Metal.GOLD, LocalDate.of(2026, 11, 9),
                new BigDecimal("6877.4350"), new BigDecimal("221.1147"), QuoteSource.ADMIN, NOW);
        ProductVariant variant = metalLinked("3.250", "12.00", "20.00", "250.00", "15.00", null, null);
        variant.applyMetalPrice(variant.getPrice(), corrected, NOW);

        PriceBreakdownDto breakdown = PriceBreakdownDto.of(variant);

        assertThat(breakdown.metal().source()).isEqualTo(QuoteSource.ADMIN);
        assertThat(breakdown.metal().quoteDate()).isEqualTo("2026-11-09");
    }
}
