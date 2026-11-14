package az.jeparla.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.pricing.cbar.CbarBulletin;
import az.jeparla.product.Metal;
import az.jeparla.support.CatalogApiTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/** {@code GET /api/v1/exchange-rates/latest} (#53): the newest stored CBAR rate of USD and EUR, anonymous. */
@CatalogApiTest
class ExchangeRateApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ExchangeRateService service;

    private static CbarBulletin bulletin(LocalDate date, Map<String, BigDecimal> rates) {
        BigDecimal one = BigDecimal.ONE;
        return new CbarBulletin(date, Map.of(Metal.GOLD, one, Metal.SILVER, one, Metal.PLATINUM, one,
                Metal.PALLADIUM, one), rates);
    }

    @Test
    void storesOncePerDayAndServesTheNewest() throws Exception {
        Instant now = Instant.parse("2026-11-06T09:00:00Z");
        LocalDate day = LocalDate.of(2026, 11, 6);
        assertThat(service.store(bulletin(day.minusDays(1), Map.of("USD", new BigDecimal("1.7"))), now)).isEqualTo(1);
        assertThat(service.store(bulletin(day, Map.of("USD", new BigDecimal("1.7"), "EUR",
                new BigDecimal("1.9037"))), now)).isEqualTo(2);
        assertThat(service.store(bulletin(day, Map.of("USD", new BigDecimal("1.8"))), now)).isZero();

        mvc.perform(get("/api/v1/exchange-rates/latest"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", Matchers.containsString("public")))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].currency").value("USD"))
                .andExpect(jsonPath("$[0].date").value("2026-11-06"))
                .andExpect(jsonPath("$[0].aznPerUnit").value("1.700000"))
                .andExpect(jsonPath("$[1].currency").value("EUR"))
                .andExpect(jsonPath("$[1].aznPerUnit").value("1.903700"));
    }
}
