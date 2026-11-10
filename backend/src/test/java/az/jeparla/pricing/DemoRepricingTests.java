package az.jeparla.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.pricing.MetalPriceJob.Report;
import az.jeparla.pricing.MetalPriceJob.Trigger;
import az.jeparla.pricing.MetalQuoteService.Outcome;
import az.jeparla.pricing.MetalQuoteService.StoredQuote;
import az.jeparla.product.Metal;
import az.jeparla.support.CbarStub.Answer;
import az.jeparla.support.MetalPriceJobTest;
import az.jeparla.support.MetalPriceJobTest.MutableClock;
import az.jeparla.support.MetalPriceJobTestSupport;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The real CBAR bulletin of 06.11.2026 against the demo catalog (#44, review note on the rounding):
 * every METAL_LINKED variant of an applied metal is repriced without an ArithmeticException, to the
 * price the engine (= pricing.ts) gives, and the large real moves against the demo quotes of 03.11
 * (platinum -11.0%, palladium -30.4%) are held.
 */
@MetalPriceJobTest
@ActiveProfiles("demo")
class DemoRepricingTests {

    @Autowired
    private MetalPriceJob job;

    @Autowired
    private MetalPriceJobTestSupport db;

    @Autowired
    private MutableClock clock;

    private Map<Long, Map<String, Object>> variants() {
        return db.jdbc().queryForList("""
                SELECT v.id, v.price, v.pricing_mode, v.weight_grams, f.value AS fineness, f.metal, v.labor_per_gram,
                       v.labor_fixed, v.stone_price, v.markup_percent, v.min_price, v.max_price, v.metal_snapshot_id
                FROM product_variants v JOIN finenesses f ON f.id = v.fineness_id
                """).stream().collect(Collectors.toMap(row -> (Long) row.get("id"), row -> row));
    }

    @Test
    void realBulletinRepricesTheDemoCatalog() {
        MetalPriceJobTest.STUB.reset();
        MetalPriceJobTest.STUB.always(Answer.fixture("cbar-2026-11-06.xml"));
        clock.setBaku("2026-11-06", "10:15");
        Map<Long, Map<String, Object>> before = variants();
        assertThat(before).hasSize(60);

        Report report = job.runLocked(Trigger.INTERNAL).orElseThrow();

        Map<Metal, StoredQuote> quotes = report.quotes().stream()
                .collect(Collectors.toMap(StoredQuote::metal, q -> q));
        assertThat(quotes.get(Metal.GOLD).outcome()).isEqualTo(Outcome.APPLIED);
        assertThat(quotes.get(Metal.GOLD).changePercent()).isEqualByComparingTo("-1.8");
        assertThat(quotes.get(Metal.SILVER).outcome()).isEqualTo(Outcome.APPLIED);
        assertThat(quotes.get(Metal.SILVER).changePercent()).isEqualByComparingTo("3.1");
        assertThat(quotes.get(Metal.PLATINUM).outcome()).isEqualTo(Outcome.HELD);
        assertThat(quotes.get(Metal.PLATINUM).changePercent()).isEqualByComparingTo("-11.0");
        assertThat(quotes.get(Metal.PALLADIUM).outcome()).isEqualTo(Outcome.HELD);
        assertThat(quotes.get(Metal.PALLADIUM).changePercent()).isEqualByComparingTo("-30.4");
        assertThat(report.heldMetals()).containsExactly(Metal.PLATINUM, Metal.PALLADIUM);
        assertThat(report.total().failed()).isZero();

        Map<Metal, Long> newQuote = db.jdbc().queryForList(
                "SELECT metal, id FROM metal_price_snapshots WHERE quote_date = '2026-11-06' AND status = 'APPLIED'")
                .stream().collect(Collectors.toMap(r -> Metal.valueOf((String) r.get("metal")), r -> (Long) r.get("id")));
        Map<Metal, BigDecimal> newGram = Map.of(Metal.GOLD, new BigDecimal("221.1147"), Metal.SILVER,
                new BigDecimal("2.8185"));
        assertThat(newQuote).containsOnlyKeys(Metal.GOLD, Metal.SILVER);

        Map<Long, Map<String, Object>> after = variants();
        int repriced = 0;
        int changed = 0;
        for (Map.Entry<Long, Map<String, Object>> entry : after.entrySet()) {
            Map<String, Object> was = before.get(entry.getKey());
            Map<String, Object> now = entry.getValue();
            Metal metal = Metal.valueOf((String) now.get("metal"));
            boolean linked = "METAL_LINKED".equals(now.get("pricing_mode"));
            if (!linked || !newQuote.containsKey(metal)) {
                // FIXED variants and held metals keep their price and quote.
                assertThat(now.get("price")).as("variant %d", entry.getKey()).isEqualTo(was.get("price"));
                assertThat(now.get("metal_snapshot_id")).isEqualTo(was.get("metal_snapshot_id"));
                continue;
            }
            BigDecimal expected = PricingEngine.price((BigDecimal) now.get("weight_grams"),
                    ((Number) now.get("fineness")).intValue(), newGram.get(metal), new PricingEngine.Rule(
                            (BigDecimal) now.get("labor_per_gram"), (BigDecimal) now.get("labor_fixed"),
                            (BigDecimal) now.get("stone_price"), (BigDecimal) now.get("markup_percent"),
                            (BigDecimal) now.get("min_price"), (BigDecimal) now.get("max_price")));
            assertThat(now.get("price")).as("variant %d", entry.getKey()).isEqualTo(expected);
            assertThat(now.get("metal_snapshot_id")).isEqualTo(newQuote.get(metal));
            repriced++;
            if (((BigDecimal) was.get("price")).compareTo(expected) != 0) {
                changed++;
                assertThat(db.historyRows(entry.getKey())).isEqualTo(1);
            } else {
                assertThat(db.historyRows(entry.getKey())).isZero();
            }
        }
        assertThat(repriced).isPositive().isEqualTo(report.total().updated() + report.total().unchanged());
        assertThat(changed).isEqualTo(report.total().updated());
        assertThat(db.count("SELECT count(*) FROM price_history")).isEqualTo(changed);
        // The public endpoint still shows the 03.11 quotes of the held metals.
        assertThat(db.jdbc().queryForList("""
                SELECT metal FROM metal_price_snapshots WHERE status = 'HELD' ORDER BY metal
                """, String.class)).isEqualTo(List.of("PALLADIUM", "PLATINUM"));
    }
}
