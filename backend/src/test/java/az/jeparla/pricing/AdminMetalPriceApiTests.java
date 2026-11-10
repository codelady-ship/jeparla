package az.jeparla.pricing;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.auth.User;
import az.jeparla.pricing.MetalPriceJob.Trigger;
import az.jeparla.product.Metal;
import az.jeparla.support.CbarStub.Answer;
import az.jeparla.support.MetalPriceJobTest;
import az.jeparla.support.MetalPriceJobTest.MutableClock;
import az.jeparla.support.MetalPriceJobTestSupport;
import az.jeparla.support.TestData;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Admin metal prices (#43): the held queue, accept / discard, the manual override, audit and repricing.
 * Same routes and bodies as frontend/src/app/api/admin/metal-prices.
 */
@MetalPriceJobTest
class AdminMetalPriceApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private MetalPriceJob job;

    @Autowired
    private MetalPriceJobTestSupport db;

    @Autowired
    private MutableClock clock;

    @Autowired
    private TestData data;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private long adminId;

    @BeforeEach
    void setUp() {
        db.clean();
        clock.setBaku("2026-11-06", "10:15");
        User user = new TransactionTemplate(transactionManager).execute(status -> data.buyer());
        adminId = user.getId();
    }

    private JwtRequestPostProcessor as(String role) {
        return jwt().jwt(token -> token.subject(String.valueOf(adminId)))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    /** Gold in use at 6000.00 (05.11), the CBAR quote of 06.11 (6877.435, +14.6%) held. */
    private long heldGold() {
        db.quote(Metal.GOLD, "2026-11-04", "5900.00", QuoteSource.CBAR);
        db.quote(Metal.GOLD, "2026-11-05", "6000.00", QuoteSource.CBAR);
        db.quote(Metal.SILVER, "2026-11-05", "87.00", QuoteSource.CBAR);
        db.quote(Metal.PLATINUM, "2026-11-05", "2600.00", QuoteSource.CBAR);
        db.quote(Metal.PALLADIUM, "2026-11-05", "1700.00", QuoteSource.CBAR);
        long gold = db.metalLinkedVariant(Metal.GOLD, 585, "1.000", "100.00", "0", "0", "0", "0", null, null);
        MetalPriceJobTest.STUB.always(Answer.fixture("cbar-2026-11-06.xml"));
        assertThat(job.runLocked(Trigger.INTERNAL).orElseThrow().heldMetals()).containsExactly(Metal.GOLD);
        return gold;
    }

    @Test
    void listShowsThePriceInUseAndTheHeldQuote() throws Exception {
        heldGold();
        mvc.perform(get("/api/v1/admin/metal-prices").with(as("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].metal").value("GOLD"))
                .andExpect(jsonPath("$[0].date").value("2026-11-05"))
                .andExpect(jsonPath("$[0].pricePerOunce").value("6000.0000"))
                .andExpect(jsonPath("$[0].pricePerGram").value("192.9045"))
                .andExpect(jsonPath("$[0].previousPerOunce").value("5900.0000"))
                .andExpect(jsonPath("$[0].change").value("1.7"))
                .andExpect(jsonPath("$[0].source").value("CBAR"))
                .andExpect(jsonPath("$[0].held.date").value("2026-11-06"))
                .andExpect(jsonPath("$[0].held.pricePerOunce").value("6877.4350"))
                .andExpect(jsonPath("$[0].held.change").value("14.6"))
                .andExpect(jsonPath("$[0].held.status").value("HELD"))
                .andExpect(jsonPath("$[1].metal").value("SILVER"))
                .andExpect(jsonPath("$[1].date").value("2026-11-06"))
                .andExpect(jsonPath("$[1].held").isEmpty());
    }

    @Test
    void acceptingTheHeldQuoteAppliesItRepricesAndIsAudited() throws Exception {
        long gold = heldGold();
        mvc.perform(json(patch("/api/v1/admin/metal-prices/GOLD/held").with(as("ADMIN")),
                        "{\"action\":\"accept\",\"reason\":\"\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metal").value("GOLD"))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.note").isEmpty())
                .andExpect(jsonPath("$.repricing").value("DONE"));

        // 1 x 585/1000 x 221.1147 = 129.35, from the accepted quote.
        assertThat(db.price(gold)).isEqualTo(new BigDecimal("129.35"));
        mvc.perform(get("/api/v1/metal-prices/latest"))
                .andExpect(jsonPath("$[0].date").value("2026-11-06"))
                .andExpect(jsonPath("$[0].pricePerOunce").value("6877.4350"));
        Map<String, Object> audit = db.jdbc().queryForMap(
                "SELECT action, target_type, actor_id, actor_role, details::text AS details FROM audit_logs");
        assertThat(audit).containsEntry("action", "METAL_PRICE_ACCEPTED").containsEntry("target_type", "PRICE")
                .containsEntry("actor_id", adminId).containsEntry("actor_role", "ADMIN");
        assertThat((String) audit.get("details")).contains("\"changePercent\": \"14.6\"");
        assertThat(db.jdbc().queryForObject("SELECT decided_by FROM metal_price_snapshots WHERE status = 'APPLIED'"
                + " AND metal = 'GOLD' AND quote_date = '2026-11-06'", Long.class)).isEqualTo(adminId);
        // Nothing is held any more.
        mvc.perform(json(patch("/api/v1/admin/metal-prices/GOLD/held").with(as("ADMIN")), "{\"action\":\"accept\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("metal_prices.nothing_held"));
    }

    @Test
    void discardingNeedsAReasonAndKeepsThePriceInUse() throws Exception {
        long gold = heldGold();
        BigDecimal before = db.price(gold);
        mvc.perform(json(patch("/api/v1/admin/metal-prices/GOLD/held").with(as("ADMIN")),
                        "{\"action\":\"discard\",\"reason\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"))
                .andExpect(jsonPath("$.errors[0].field").value("reason"));
        mvc.perform(json(patch("/api/v1/admin/metal-prices/GOLD/held").with(as("ADMIN")),
                        "{\"action\":\"delete\",\"reason\":\"Mənbə ilə uyğun gəlmir.\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(json(patch("/api/v1/admin/metal-prices/GOLD/held").with(as("ADMIN")),
                        "{\"action\":\"discard\",\"reason\":\"Mənbə ilə uyğun gəlmir.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISCARDED"))
                .andExpect(jsonPath("$.note").value("Mənbə ilə uyğun gəlmir."))
                .andExpect(jsonPath("$.repricing").value("NONE"));

        assertThat(db.price(gold)).isEqualTo(before);
        assertThat(db.count("SELECT count(*) FROM audit_logs WHERE action = 'METAL_PRICE_DISCARDED'")).isEqualTo(1);
        mvc.perform(get("/api/v1/admin/metal-prices").with(as("ADMIN"))).andExpect(jsonPath("$[0].held").isEmpty());
    }

    @Test
    void overrideAboveTheLimitNeedsConfirmation() throws Exception {
        long gold = heldGold();
        String body = "{\"pricePerOunce\":\"%s\",\"reason\":\"AMB faylı gecikir, bank qiyməti.\",\"confirmLarge\":%s}";

        mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD").with(as("ADMIN")), body.formatted("6800.00", false)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("metal_prices.large_change"))
                .andExpect(jsonPath("$.errors[0].field").value("pricePerOunce"));
        assertThat(db.count("SELECT count(*) FROM metal_price_snapshots WHERE source = 'ADMIN'")).isZero();

        mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD").with(as("ADMIN")), body.formatted("6800,00", true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metal").value("GOLD"))
                .andExpect(jsonPath("$.date").value("2026-11-06"))
                .andExpect(jsonPath("$.pricePerOunce").value("6800.0000"))
                .andExpect(jsonPath("$.pricePerGram").value("218.6251"))
                .andExpect(jsonPath("$.change").value("13.3"))
                .andExpect(jsonPath("$.source").value("ADMIN"))
                .andExpect(jsonPath("$.note").value("AMB faylı gecikir, bank qiyməti."))
                .andExpect(jsonPath("$.repricing").value("DONE"));

        // 1 x 585/1000 x 218.6251 = 127.90
        assertThat(db.price(gold)).isEqualTo(new BigDecimal("127.90"));
        mvc.perform(get("/api/v1/metal-prices/latest"))
                .andExpect(jsonPath("$[0].source").value("ADMIN"))
                .andExpect(jsonPath("$[0].pricePerOunce").value("6800.0000"));

        // A typo can be fixed the same day: the newest override is in use.
        mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD").with(as("ADMIN")), body.formatted("6810.5", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.change").value("0.2"));
        mvc.perform(get("/api/v1/metal-prices/latest")).andExpect(jsonPath("$[0].pricePerOunce").value("6810.5000"));
        assertThat(db.count("SELECT count(*) FROM audit_logs WHERE action = 'METAL_PRICE_OVERRIDDEN'")).isEqualTo(2);
        // The override replaced the held quote of the same day.
        mvc.perform(get("/api/v1/admin/metal-prices").with(as("ADMIN"))).andExpect(jsonPath("$[0].held").isEmpty());
    }

    @Test
    void overrideValidatesItsInput() throws Exception {
        db.quote(Metal.GOLD, "2026-11-05", "6000.00", QuoteSource.CBAR);
        for (String price : new String[] {"0", "0.00", "-1", "12.345", "12345678", "abc", ""}) {
            mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD").with(as("ADMIN")),
                            "{\"pricePerOunce\":\"" + price + "\",\"reason\":\"Yoxlama üçün səbəb.\"}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD").with(as("ADMIN")),
                        "{\"pricePerOunce\":\"6000.00\",\"reason\":\"  qısa  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"));
        mvc.perform(json(put("/api/v1/admin/metal-prices/COPPER").with(as("ADMIN")),
                        "{\"pricePerOunce\":\"6000.00\",\"reason\":\"Yoxlama üçün səbəb.\"}"))
                .andExpect(status().isBadRequest());
        assertThat(db.count("SELECT count(*) FROM metal_price_snapshots WHERE source = 'ADMIN'")).isZero();
    }

    @Test
    void onlyAdminsMayUseIt() throws Exception {
        String override = "{\"pricePerOunce\":\"6000.00\",\"reason\":\"Yoxlama üçün səbəb.\"}";
        mvc.perform(get("/api/v1/admin/metal-prices")).andExpect(status().isUnauthorized());
        mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD"), override)).andExpect(status().isUnauthorized());
        for (String role : new String[] {"USER", "MERCHANT"}) {
            mvc.perform(get("/api/v1/admin/metal-prices").with(as(role))).andExpect(status().isForbidden());
            mvc.perform(json(put("/api/v1/admin/metal-prices/GOLD").with(as(role)), override))
                    .andExpect(status().isForbidden());
            mvc.perform(json(patch("/api/v1/admin/metal-prices/GOLD/held").with(as(role)), "{\"action\":\"accept\"}"))
                    .andExpect(status().isForbidden());
        }
        assertThat(db.count("SELECT count(*) FROM metal_price_snapshots")).isZero();
    }
}
