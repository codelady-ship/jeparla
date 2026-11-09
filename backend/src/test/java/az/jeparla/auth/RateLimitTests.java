package az.jeparla.auth;

import static az.jeparla.support.AuthTestClient.uniqueEmail;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Rate limits on the auth endpoints, counted in the Redis container (as in production). */
@AuthIntegrationTest
class RateLimitTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate redis;

    @Test
    void loginFromOneAddressIsLimitedWithA429InThreeLanguages() throws Exception {
        String ip = AuthTestClient.nextIp();
        for (int i = 0; i < AuthIntegrationTest.LOGIN_IP_LIMIT; i++) {
            mockMvc.perform(login(ip, uniqueEmail(), "az")).andExpect(status().isUnauthorized());
        }

        mockMvc.perform(login(ip, uniqueEmail(), "az"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("rate_limited"))
                .andExpect(jsonPath("$.title").value("Çox sayda sorğu"))
                .andExpect(jsonPath("$.detail").value("Qısa müddətdə çox cəhd edilib. Bir az sonra yenidən cəhd edin."));
        mockMvc.perform(login(ip, uniqueEmail(), "en"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.title").value("Too many requests"))
                .andExpect(jsonPath("$.detail").value("Too many attempts in a short time. Please try again later."));
        mockMvc.perform(login(ip, uniqueEmail(), "ru"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.title").value("Слишком много запросов"))
                .andExpect(jsonPath("$.detail")
                        .value("Слишком много попыток за короткое время. Повторите попытку позже."));

        // Another address is not affected.
        mockMvc.perform(login(AuthTestClient.nextIp(), uniqueEmail(), "az")).andExpect(status().isUnauthorized());
    }

    @Test
    void retryAfterIsWithinTheWindow() throws Exception {
        String ip = AuthTestClient.nextIp();
        for (int i = 0; i < AuthIntegrationTest.LOGIN_IP_LIMIT; i++) {
            mockMvc.perform(login(ip, uniqueEmail(), "az"));
        }
        String retryAfter = mockMvc.perform(login(ip, uniqueEmail(), "az"))
                .andExpect(status().isTooManyRequests())
                .andReturn().getResponse().getHeader(HttpHeaders.RETRY_AFTER);
        assertThat(Long.parseLong(retryAfter)).isBetween(1L, 300L);
    }

    @Test
    void oneAccountIsLimitedAcrossAddresses() throws Exception {
        String email = uniqueEmail();
        for (int i = 0; i < AuthIntegrationTest.LOGIN_ACCOUNT_LIMIT; i++) {
            mockMvc.perform(login(AuthTestClient.nextIp(), email, "az")).andExpect(status().isUnauthorized());
        }
        // Same account in another spelling, from yet another address.
        mockMvc.perform(login(AuthTestClient.nextIp(), email.toUpperCase(), "en"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("rate_limited"));
    }

    @Test
    void registrationIsLimitedPerAddress() throws Exception {
        AuthTestClient client = new AuthTestClient(mockMvc);
        for (int i = 0; i < AuthIntegrationTest.REGISTER_IP_LIMIT; i++) {
            assertThat(client.register("Aysel", uniqueEmail(), "parol123").getStatus()).isEqualTo(201);
        }
        assertThat(client.register("Aysel", uniqueEmail(), "parol123").getStatus()).isEqualTo(429);
    }

    @Test
    void countersLiveInRedisWithoutPersonalData() throws Exception {
        String email = uniqueEmail();
        String ip = AuthTestClient.nextIp();
        mockMvc.perform(login(ip, email, "az")).andExpect(status().isUnauthorized());

        Set<String> keys = redis.keys("jeparla:rl:*");
        assertThat(keys).isNotEmpty()
                .anyMatch(key -> key.startsWith("jeparla:rl:login-ip:"))
                .anyMatch(key -> key.startsWith("jeparla:rl:login-account:"))
                .noneMatch(key -> key.contains(email) || key.contains(ip));
        assertThat(keys).allSatisfy(key -> assertThat(redis.getExpire(key)).isPositive());
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder login(String ip,
            String email, String language) {
        return post("/api/v1/auth/login")
                .with(AuthTestClient.from(ip))
                .header(HttpHeaders.ACCEPT_LANGUAGE, language)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"" + email + "\",\"password\":\"parol123\"}");
    }
}
