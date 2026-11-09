package az.jeparla.pricing;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** {@code GET /api/v1/metal-prices/latest} and {@code /history}: only APPLIED quotes, decimals as strings. */
@CatalogApiTest
class MetalPriceApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    private void quote(String metal, String date, String ounce, String status) {
        jdbc.update("""
                INSERT INTO metal_price_snapshots (metal, quote_date, price_per_ounce, price_per_gram, currency, source,
                                                   status, fetched_at)
                VALUES (?, ?::date, ?::numeric, round(?::numeric / 31.1034768, 4), 'AZN', 'CBAR', ?, now())
                """, metal, date, ounce, ounce, status);
    }

    @Test
    void latestHasOneQuotePerMetal() throws Exception {
        mvc.perform(get("/api/v1/metal-prices/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].metal").value("GOLD"))
                .andExpect(jsonPath("$[0].date").value("2026-11-03"))
                .andExpect(jsonPath("$[0].pricePerOunce").value("7000.0000"))
                .andExpect(jsonPath("$[0].pricePerGram").value("225.0552"))
                .andExpect(jsonPath("$[0].currency").value("AZN"))
                .andExpect(jsonPath("$[0].source").value("CBAR"));
    }

    @Test
    void heldQuotesAreNeverShown() throws Exception {
        quote("GOLD", "2026-11-04", "9000.00", "HELD");
        quote("GOLD", "2026-11-02", "6900.00", "APPLIED");
        mvc.perform(get("/api/v1/metal-prices/latest")).andExpect(jsonPath("$[0].date").value("2026-11-03"));
        mvc.perform(get("/api/v1/metal-prices/history?metal=GOLD&days=30"))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].date").value("2026-11-02"))
                .andExpect(jsonPath("$[1].date").value("2026-11-03"));
        mvc.perform(get("/api/v1/metal-prices/history?metal=GOLD&days=1"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].date").value("2026-11-03"));
    }

    @Test
    void historyValidatesItsParameters() throws Exception {
        mvc.perform(get("/api/v1/metal-prices/history?metal=COPPER")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("metal"));
        mvc.perform(get("/api/v1/metal-prices/history?metal=GOLD&days=0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/metal-prices/history?metal=GOLD&days=367")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/metal-prices/history")).andExpect(status().isBadRequest());
    }
}
