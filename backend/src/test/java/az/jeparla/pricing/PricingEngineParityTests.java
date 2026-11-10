package az.jeparla.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.pricing.PricingEngine.Breakdown;
import az.jeparla.pricing.PricingEngine.Rule;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Parity with the frontend (#44): {@code src/test/resources/pricing/pricing-cases.json} holds what
 * frontend/src/lib/pricing.ts (big.js) returns for 77 gram prices, 12 percent changes and 428
 * METAL_LINKED inputs (the shared examples, half-cent edges, clamps, the CBAR quotes of the fixtures
 * and a deterministic random table within the column limits). The engine must return the same strings,
 * part by part. Regenerate with {@code node backend/src/test/resources/pricing/generate.mjs}.
 */
class PricingEngineParityTests {

    private static final JsonNode CASES = load();

    private static JsonNode load() {
        try (InputStream in = PricingEngineParityTests.class.getClassLoader()
                .getResourceAsStream("pricing/pricing-cases.json")) {
            return new ObjectMapper().readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static BigDecimal d(JsonNode node) {
        return node == null || node.isNull() ? null : new BigDecimal(node.asString());
    }

    private static Stream<Arguments> linked() {
        List<Arguments> cases = new ArrayList<>();
        CASES.get("linked").forEach(c -> cases.add(Arguments.of(c.get("name").asString(), c)));
        return cases.stream();
    }

    @Test
    void theTableIsComplete() {
        assertThat(CASES.get("gramPrices").size()).isEqualTo(77);
        assertThat(CASES.get("changes").size()).isEqualTo(12);
        assertThat(CASES.get("linked").size()).isEqualTo(428);
        // Every branch is covered: both limits decide some prices, most are not clamped.
        List<String> clamps = new ArrayList<>();
        CASES.get("linked").forEach(c -> {
            JsonNode clamped = c.get("breakdown").get("clamped");
            clamps.add(clamped.isNull() ? "none" : clamped.asString());
        });
        assertThat(clamps).contains("MIN", "MAX", "none");
    }

    @Test
    void gramPricesMatch() {
        CASES.get("gramPrices").forEach(c -> assertThat(PricingEngine.gramPrice(d(c.get("ounce"))).toPlainString())
                .as("gram price of %s", c.get("ounce").asString())
                .isEqualTo(c.get("gram").asString()));
    }

    @Test
    void percentChangesMatch() {
        CASES.get("changes").forEach(c -> assertThat(
                PricingEngine.percentChange(d(c.get("from")), d(c.get("to"))).toPlainString())
                .as("%s -> %s", c.get("from").asString(), c.get("to").asString())
                .isEqualTo(c.get("change").asString()));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("linked")
    void metalLinkedPricesMatch(String name, JsonNode c) {
        JsonNode r = c.get("rule");
        Rule rule = new Rule(d(r.get("laborPerGram")), d(r.get("laborFixed")), d(r.get("stonePrice")),
                d(r.get("markupPercent")), d(r.get("minPrice")), d(r.get("maxPrice")));
        Breakdown actual = PricingEngine.breakdown(d(c.get("weightGrams")), c.get("fineness").asInt(),
                d(c.get("pureGramPrice")), rule);

        JsonNode expected = c.get("breakdown");
        assertThat(actual.total().toPlainString()).as("total").isEqualTo(expected.get("total").asString());
        assertThat(actual.metal().toPlainString()).as("metal").isEqualTo(expected.get("metal").asString());
        assertThat(actual.labor().toPlainString()).as("labor").isEqualTo(expected.get("labor").asString());
        assertThat(actual.stone().toPlainString()).as("stone").isEqualTo(expected.get("stone").asString());
        assertThat(actual.markup().toPlainString()).as("markup").isEqualTo(expected.get("markup").asString());
        String clamped = expected.get("clamped").isNull() ? null : expected.get("clamped").asString();
        assertThat(actual.clamped() == null ? null : actual.clamped().name()).as("clamped").isEqualTo(clamped);
    }
}
