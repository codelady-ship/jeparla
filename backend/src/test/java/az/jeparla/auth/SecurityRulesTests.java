package az.jeparla.auth;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.AuthIntegrationTest;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

/** URL rules, method security, role hierarchy, token validation, actuator and headers. */
@AuthIntegrationTest
class SecurityRulesTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    private static JwtRequestPostProcessor as(String role) {
        return jwt().jwt(token -> token.subject("1")).authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    // ------------------------------------------------------------------ anonymous

    @Test
    void publicCatalogGetsAreAnonymous() throws Exception {
        // The catalog endpoints come with #37: today the answer is 404, but never 401.
        mockMvc.perform(get("/api/v1/products")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/stores/some-store")).andExpect(status().isNotFound());
    }

    @Test
    void writesNeedASignedInUserAsLocalizedProblem() throws Exception {
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Sign-in required"))
                .andExpect(jsonPath("$.code").value("auth.unauthenticated"));
        mockMvc.perform(post("/api/v1/test/secure/ping"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Giriş tələb olunur"));
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.ACCEPT_LANGUAGE, "ru"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Требуется вход"));
    }

    @Test
    void anonymousOnMethodSecuredEndpointIs401() throws Exception {
        mockMvc.perform(get("/api/v1/test/secure/merchant-only"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("auth.unauthenticated"));
    }

    @Test
    void merchantAndAdminAreasNeedSignIn() throws Exception {
        mockMvc.perform(get("/api/v1/merchant/test/ping")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/test/ping")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ roles

    @Test
    void userCannotReachMerchantOrAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/merchant/test/ping").with(as("USER")))
                .andExpect(status().isForbidden())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
        mockMvc.perform(get("/api/v1/admin/test/ping").with(as("USER"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/test/secure/merchant-only").with(as("USER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
    }

    @Test
    void merchantReachesMerchantAreaButNotAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/merchant/test/ping").with(as("MERCHANT"))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/test/secure/merchant-only").with(as("MERCHANT"))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/test/ping").with(as("MERCHANT"))).andExpect(status().isForbidden());
    }

    @Test
    void adminReachesAdminAreaButDoesNotActAsMerchant() throws Exception {
        mockMvc.perform(get("/api/v1/admin/test/ping").with(as("ADMIN"))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/merchant/test/ping").with(as("ADMIN"))).andExpect(status().isForbidden());
    }

    @Test
    void merchantAndAdminIncludeUser() throws Exception {
        for (String role : List.of("USER", "MERCHANT", "ADMIN")) {
            mockMvc.perform(post("/api/v1/test/secure/user-only").with(as(role))).andExpect(status().isOk());
        }
    }

    // ------------------------------------------------------------------ token validation

    @Test
    void validTokenIsAccepted() throws Exception {
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.AUTHORIZATION, bearer(token(
                        claims(Instant.now()).build()))))
                .andExpect(status().isOk());
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() throws Exception {
        JwtEncoder other = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(new SecretKeySpec(
                "another-key-another-key-another-key-1".getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
        String forged = other.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),
                claims(Instant.now()).claim(JwtConfig.ROLES_CLAIM, List.of("ADMIN")).build())).getTokenValue();
        mockMvc.perform(get("/api/v1/admin/test/ping").header(HttpHeaders.AUTHORIZATION, bearer(forged)))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(jsonPath("$.code").value("auth.invalid_token"));
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        Instant issued = Instant.now().minus(2, ChronoUnit.HOURS);
        String expired = token(claims(issued).expiresAt(issued.plus(15, ChronoUnit.MINUTES)).build());
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.AUTHORIZATION, bearer(expired)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("auth.invalid_token"));
    }

    @Test
    void tokenFromAnotherIssuerOrAudienceIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.AUTHORIZATION,
                        bearer(token(claims(Instant.now()).issuer("someone-else").build()))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.AUTHORIZATION,
                        bearer(token(claims(Instant.now()).audience(List.of("other-api")).build()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unsignedTokenIsRejected() throws Exception {
        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        String header = b64.encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        long exp = Instant.now().plusSeconds(600).getEpochSecond();
        String payload = b64.encodeToString(("{\"sub\":\"1\",\"iss\":\"jeparla\",\"aud\":[\"jeparla-api\"],"
                + "\"roles\":[\"ADMIN\"],\"exp\":" + exp + "}").getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(get("/api/v1/admin/test/ping").header(HttpHeaders.AUTHORIZATION, bearer(header + "." + payload + ".")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void garbageTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/test/secure/ping").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("auth.invalid_token"));
    }

    // ------------------------------------------------------------------ actuator and headers

    @Test
    void healthIsPublicAndTheRestOfActuatorIsClosed() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/actuator")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/actuator/env").with(as("ADMIN"))).andExpect(status().isForbidden());
    }

    @Test
    void apiResponsesCarrySecurityHeaders() throws Exception {
        mockMvc.perform(post("/api/v1/test/secure/ping").with(as("USER")).secure(true))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
                .andExpect(header().string("Strict-Transport-Security", containsString("max-age=31536000")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
    }

    @Test
    void swaggerUiIsNotBlockedByTheApiContentSecurityPolicy() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Content-Security-Policy"));
    }

    private JwtClaimsSet.Builder claims(Instant issuedAt) {
        return JwtClaimsSet.builder()
                .issuer(JwtConfig.ISSUER)
                .audience(List.of(JwtConfig.AUDIENCE))
                .subject("1")
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plus(15, ChronoUnit.MINUTES))
                .claim(JwtConfig.ROLES_CLAIM, List.of("USER"));
    }

    private String token(JwtClaimsSet claims) {
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
