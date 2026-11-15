package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import az.jeparla.support.TestData;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * The two public POSTs (#37): WhatsApp contact clicks and product reports. Both work without an
 * account and are rate limited per IP (small limits in {@link CatalogApiTest}).
 */
@CatalogApiTest
class ProductFeedbackApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    /** A fresh client address, so rate-limit counters of other tests do not interfere. */
    private static String newIp() {
        int n = TestData.next();
        return "10.37." + (n / 250 % 250) + "." + (n % 250 + 1);
    }

    private static MockHttpServletRequestBuilder from(MockHttpServletRequestBuilder request, String ip) {
        return request.with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private Long clicks(long productId) {
        return jdbc.queryForObject("SELECT coalesce(sum(clicks), 0) FROM product_contact_clicks WHERE product_id = ?",
                Long.class, productId);
    }

    @Test
    void guestsAreCountedPerProductAndDay() throws Exception {
        String ip = newIp();
        mvc.perform(from(post("/api/v1/products/7/contact-click"), ip)).andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/7/contact-click"), ip)).andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/8/contact-click"), newIp())).andExpect(status().isNoContent());

        assertThat(clicks(7)).isEqualTo(2);
        assertThat(clicks(8)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_contact_clicks WHERE product_id = 7", Long.class))
                .as("one row per product and day").isOne();
    }

    @Test
    void theReadyQuestionIsCountedWithoutAnythingAboutTheBuyer() throws Exception {
        mvc.perform(from(post("/api/v1/products/12/contact-click").param("question", "SIZE"), newIp()))
                .andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/12/contact-click").param("question", "SIZE"), newIp()))
                .andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/12/contact-click").param("question", "PRICE"), newIp()))
                .andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/12/contact-click"), newIp())).andExpect(status().isNoContent());

        assertThat(clicks(12)).as("every click is in the total").isEqualTo(4);
        Map<String, Object> byQuestion = new java.util.HashMap<>();
        jdbc.query("SELECT question, sum(clicks) AS n FROM product_contact_question_clicks WHERE product_id = 12 "
                + "GROUP BY question", rs -> {
                    byQuestion.put(rs.getString("question"), rs.getLong("n"));
                });
        assertThat(byQuestion).containsEntry("SIZE", 2L).containsEntry("PRICE", 1L).hasSize(2);
        mvc.perform(from(post("/api/v1/products/12/contact-click").param("question", "NOPE"), newIp()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void clicksOverTheLimitAreNotCountedButNotRefused() throws Exception {
        String ip = newIp();
        for (int i = 0; i < CatalogApiTest.CONTACT_IP_LIMIT + 2; i++) {
            mvc.perform(from(post("/api/v1/products/9/contact-click"), ip)).andExpect(status().isNoContent());
        }
        assertThat(clicks(9)).isEqualTo(CatalogApiTest.CONTACT_IP_LIMIT);
        mvc.perform(from(post("/api/v1/products/999999/contact-click"), ip)).andExpect(status().isNotFound());
    }

    @Test
    void aGuestCanReportAProduct() throws Exception {
        mvc.perform(from(post("/api/v1/products/11/reports"), newIp()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"WRONG_PRICE\",\"message\":\"  The price is from last week.  \"}"))
                .andExpect(status().isNoContent());

        Map<String, Object> report = jdbc.queryForMap(
                "SELECT reason, message, status, reporter_id FROM product_reports WHERE product_id = 11");
        assertThat(report).containsEntry("reason", "WRONG_PRICE")
                .containsEntry("message", "The price is from last week.")
                .containsEntry("status", "OPEN")
                .containsEntry("reporter_id", null);
    }

    @Test
    void aReportNeedsAValidReason() throws Exception {
        mvc.perform(from(post("/api/v1/products/11/reports"), newIp()).contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "en").content("{\"message\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("reason"));
        mvc.perform(from(post("/api/v1/products/11/reports"), newIp()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"BORING\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(from(post("/api/v1/products/11/reports"), newIp()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"OTHER\",\"message\":\"" + "x".repeat(2001) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("message"));
        mvc.perform(from(post("/api/v1/products/999999/reports"), newIp()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"FAKE\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void reportsAreRateLimitedPerIp() throws Exception {
        String ip = newIp();
        for (int i = 0; i < CatalogApiTest.REPORT_IP_LIMIT; i++) {
            mvc.perform(from(post("/api/v1/products/12/reports"), ip).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reason\":\"FAKE\"}")).andExpect(status().isNoContent());
        }
        mvc.perform(from(post("/api/v1/products/12/reports"), ip).contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.ACCEPT_LANGUAGE, "ru").content("{\"reason\":\"FAKE\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.code").value("rate_limited"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_reports WHERE product_id = 12", Long.class))
                .isEqualTo(CatalogApiTest.REPORT_IP_LIMIT);
    }

    @Test
    void otherWritesStillNeedAnAccount() throws Exception {
        mvc.perform(post("/api/v1/products/1/anything")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/products")).andExpect(status().isUnauthorized());
    }
}
