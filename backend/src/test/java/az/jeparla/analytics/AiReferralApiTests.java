package az.jeparla.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.TestData;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * AI referrer counter (#62) over HTTP on PostgreSQL and Redis: an AI visit is counted per day, assistant and page
 * kind; bots, prefetches, other referrers and reloads are not; only an admin reads the statistics.
 */
@AuthIntegrationTest
class AiReferralApiTests {

    private static final String CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    private static String newIp() {
        int n = TestData.next();
        return "10.101." + (n / 250 % 250) + "." + (n % 250 + 1);
    }

    private static MockHttpServletRequestBuilder visit(String query, String ip, String agent) {
        MockHttpServletRequestBuilder request = post("/api/v1/visits/ai" + query);
        if (agent != null) {
            request = request.header(HttpHeaders.USER_AGENT, agent);
        }
        return request.with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private long count(String source, String page) {
        Long visits = jdbc.queryForObject("""
                SELECT COALESCE(SUM(visits), 0) FROM ai_referral_counts WHERE day = ? AND source = ? AND page = ?
                """, Long.class, LocalDate.now(ZoneId.of("Asia/Baku")), source, page);
        return visits == null ? 0 : visits;
    }

    @Test
    void aVisitFromAnAssistantIsCountedOncePerAddressAndPage() throws Exception {
        long before = count("PERPLEXITY", "PRODUCT");
        String ip = newIp();
        mvc.perform(visit("?source=https://www.perplexity.ai/&page=product", ip, CHROME))
                .andExpect(status().isNoContent());
        // A reload from the same address within the window is not a second visit.
        mvc.perform(visit("?source=https://www.perplexity.ai/&page=product", ip, CHROME))
                .andExpect(status().isNoContent());
        mvc.perform(visit("?source=perplexity&page=product", newIp(), CHROME)).andExpect(status().isNoContent());
        assertThat(count("PERPLEXITY", "PRODUCT")).isEqualTo(before + 2);
    }

    @Test
    void botsPrefetchesAndOtherReferrersAreNotCounted() throws Exception {
        long before = count("CHATGPT", "STORE");
        mvc.perform(visit("?source=chatgpt.com&page=store", newIp(), "Mozilla/5.0 (compatible; ChatGPT-User/1.0)"))
                .andExpect(status().isNoContent());
        mvc.perform(visit("?source=chatgpt.com&page=store", newIp(), null)).andExpect(status().isNoContent());
        mvc.perform(visit("?source=chatgpt.com&page=store", newIp(), CHROME).header("Sec-Purpose", "prefetch"))
                .andExpect(status().isNoContent());
        mvc.perform(visit("?source=https://www.google.com/&page=store", newIp(), CHROME))
                .andExpect(status().isNoContent());
        mvc.perform(visit("", newIp(), CHROME)).andExpect(status().isNoContent());
        assertThat(count("CHATGPT", "STORE")).isEqualTo(before);
    }

    @Test
    void onlyAnAdminReadsTheStatistics() throws Exception {
        mvc.perform(visit("?source=https://claude.ai/&page=prices", newIp(), CHROME)).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/admin/stats/ai-referrals")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/stats/ai-referrals")
                        .with(jwt().jwt(t -> t.subject("1")).authorities(new SimpleGrantedAuthority("ROLE_MERCHANT"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/stats/ai-referrals?days=7")
                        .with(jwt().jwt(t -> t.subject("1")).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.source == 'CLAUDE' && @.page == 'PRICES')].visits").isNotEmpty());
    }
}
