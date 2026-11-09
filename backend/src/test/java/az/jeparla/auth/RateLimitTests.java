package az.jeparla.auth;

import static az.jeparla.support.AuthTestClient.uniqueEmail;
import static az.jeparla.support.AuthTestClient.uniquePhone;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Rate limits on the auth endpoints, counted in the Redis container (as in production). */
@AuthIntegrationTest
class RateLimitTests {

    private static final String PASSWORD = "parol123";
    private static final String WRONG = "parol999";
    /** A reverse proxy inside {@link AuthIntegrationTest#TRUSTED_PROXIES} (stands for Caddy). */
    private static final String CADDY = "192.0.2.10";
    private static final AtomicInteger PUBLIC_IPS = new AtomicInteger();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate redis;

    /** A fresh public client address (TEST-NET-2/3), never a trusted proxy. */
    private static String publicIp() {
        int n = PUBLIC_IPS.incrementAndGet();
        return (n % 2 == 0 ? "198.51.100." : "203.0.113.") + (n / 2 % 254 + 1);
    }

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

    // --- #133: per-account limits count failed passwords only ---

    @Test
    void repeatedWrongPasswordsFromOneAddressAreLimited() throws Exception {
        String email = uniqueEmail();
        String ip = AuthTestClient.nextIp();
        for (int i = 0; i < AuthIntegrationTest.LOGIN_ACCOUNT_IP_LIMIT; i++) {
            mockMvc.perform(login(ip, email, "az")).andExpect(status().isUnauthorized());
        }
        // Same account in another spelling, same address: refused before the password is checked.
        mockMvc.perform(login(ip, email.toUpperCase(), "en"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.code").value("rate_limited"));
    }

    @Test
    void ownerSignsInAfterWrongPasswordsFromManyOtherAddresses() throws Exception {
        String phone = registerMerchant();

        // More failures than the old per-account limit (4 here, 10 in production), which counted
        // every attempt and then refused the right password too. Still under the attack threshold.
        int failures = AuthIntegrationTest.LOGIN_ACCOUNT_LIMIT - 1;
        for (int i = 0; i < failures; i++) {
            mockMvc.perform(login(AuthTestClient.nextIp(), phone, WRONG, "az")).andExpect(status().isUnauthorized());
        }

        mockMvc.perform(login(AuthTestClient.nextIp(), phone, PASSWORD, "az"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void ownerSignsInFromAKnownAddressWhileTheAccountIsUnderAttack() throws Exception {
        String phone = registerMerchant();
        String owner = AuthTestClient.nextIp();
        mockMvc.perform(login(owner, phone, PASSWORD, "az")).andExpect(status().isOk());

        // A distributed attack: many addresses, wrong passwords, well past the account threshold.
        List<Integer> statuses = new ArrayList<>();
        for (int i = 0; i < AuthIntegrationTest.LOGIN_ACCOUNT_LIMIT * 2; i++) {
            statuses.add(mockMvc.perform(login(AuthTestClient.nextIp(), phone, WRONG, "az"))
                    .andReturn().getResponse().getStatus());
        }
        assertThat(statuses.subList(0, AuthIntegrationTest.LOGIN_ACCOUNT_LIMIT)).containsOnly(401);
        // Under attack, new addresses are refused before the password is checked: guessing stops.
        assertThat(statuses.subList(AuthIntegrationTest.LOGIN_ACCOUNT_LIMIT, statuses.size())).containsOnly(429);
        mockMvc.perform(login(AuthTestClient.nextIp(), phone, PASSWORD, "az"))
                .andExpect(status().isTooManyRequests());

        // The owner, from an address the account signed in from before, still gets in.
        mockMvc.perform(login(owner, phone, PASSWORD, "az"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void knownAndUnknownAccountsGetTheSameAnswers() throws Exception {
        String known = registerMerchant();
        String unknown = uniquePhone();
        String knownIp = AuthTestClient.nextIp();
        String unknownIp = AuthTestClient.nextIp();
        List<Integer> knownStatuses = new ArrayList<>();
        List<Integer> unknownStatuses = new ArrayList<>();
        for (int i = 0; i <= AuthIntegrationTest.LOGIN_ACCOUNT_IP_LIMIT; i++) {
            knownStatuses.add(mockMvc.perform(login(knownIp, known, WRONG, "az")).andReturn().getResponse().getStatus());
            unknownStatuses.add(
                    mockMvc.perform(login(unknownIp, unknown, WRONG, "az")).andReturn().getResponse().getStatus());
        }
        assertThat(knownStatuses).isEqualTo(unknownStatuses).endsWith(429).startsWith(401);
    }

    @Test
    void registrationIsLimitedPerAddress() throws Exception {
        AuthTestClient client = new AuthTestClient(mockMvc);
        for (int i = 0; i < AuthIntegrationTest.REGISTER_IP_LIMIT; i++) {
            assertThat(client.register("Aysel", uniqueEmail(), PASSWORD).getStatus()).isEqualTo(201);
        }
        assertThat(client.register("Aysel", uniqueEmail(), PASSWORD).getStatus()).isEqualTo(429);
    }

    @Test
    void countersLiveInRedisWithoutPersonalData() throws Exception {
        String email = uniqueEmail();
        String ip = AuthTestClient.nextIp();
        mockMvc.perform(login(ip, email, "az")).andExpect(status().isUnauthorized());

        Set<String> keys = redis.keys("jeparla:rl:*");
        assertThat(keys).isNotEmpty()
                .anyMatch(key -> key.startsWith("jeparla:rl:login-ip:"))
                .anyMatch(key -> key.startsWith("jeparla:rl:login-account-ip:"))
                .anyMatch(key -> key.startsWith("jeparla:rl:login-account:"))
                .noneMatch(key -> key.contains(email) || key.contains(ip));
        assertThat(keys).allSatisfy(key -> assertThat(redis.getExpire(key)).isPositive());
    }

    // --- #132: the client address comes from trusted proxies only ---

    @Test
    void spoofedForwardingHeadersFromAClientDoNotChangeItsAddress() throws Exception {
        String ip = publicIp();
        // A new "address" in every request: none of them may open a new counter.
        for (int i = 0; i < AuthIntegrationTest.LOGIN_IP_LIMIT; i++) {
            mockMvc.perform(login(ip, uniqueEmail(), "az")
                    .header("Forwarded", "for=" + publicIp())
                    .header("X-Forwarded-For", publicIp())
                    .header("X-Real-IP", publicIp()))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(login(ip, uniqueEmail(), "az")
                .header("Forwarded", "for=\"face.cafe\"")
                .header("X-Forwarded-For", publicIp()))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void behindTheTrustedProxyTheClientAddressFromXForwardedForIsLimited() throws Exception {
        String client = publicIp();
        // Caddy sets X-Forwarded-For to the real client; a client's Forwarded header passes through.
        for (int i = 0; i < AuthIntegrationTest.LOGIN_IP_LIMIT; i++) {
            mockMvc.perform(login(CADDY, uniqueEmail(), "az")
                    .header("X-Forwarded-For", client)
                    .header("Forwarded", "for=" + publicIp()))
                    .andExpect(status().isUnauthorized());
        }
        // Rotating the left part of X-Forwarded-For (written by the client) changes nothing either.
        mockMvc.perform(login(CADDY, uniqueEmail(), "az")
                .header("X-Forwarded-For", publicIp() + ", " + client))
                .andExpect(status().isTooManyRequests());

        // Another client behind the same proxy has its own counter: the proxy is not the key.
        mockMvc.perform(login(CADDY, uniqueEmail(), "az").header("X-Forwarded-For", publicIp()))
                .andExpect(status().isUnauthorized());
    }

    private String registerMerchant() throws Exception {
        String phone = uniquePhone();
        assertThat(new AuthTestClient(mockMvc).registerMerchant("Zərgər", phone, PASSWORD).getStatus())
                .isEqualTo(201);
        return phone;
    }

    private static MockHttpServletRequestBuilder login(String ip, String login, String language) {
        return login(ip, login, PASSWORD, language);
    }

    private static MockHttpServletRequestBuilder login(String ip, String login, String password, String language) {
        return post("/api/v1/auth/login")
                .with(AuthTestClient.from(ip))
                .header(HttpHeaders.ACCEPT_LANGUAGE, language)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"" + login + "\",\"password\":\"" + password + "\"}");
    }
}
