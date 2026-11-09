package az.jeparla.auth;

import static az.jeparla.support.AuthTestClient.accessToken;
import static az.jeparla.support.AuthTestClient.refreshCookie;
import static az.jeparla.support.AuthTestClient.uniqueEmail;
import static az.jeparla.support.AuthTestClient.uniquePhone;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import az.jeparla.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

/** Register, login, refresh (rotation and reuse detection), logout and me, over HTTP. */
@AuthIntegrationTest
@ExtendWith(OutputCaptureExtension.class)
class AuthFlowTests {

    private static final String PASSWORD = "parol123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private AuthTestClient client;

    @BeforeEach
    void newClient() {
        client = new AuthTestClient(mockMvc);
    }

    private MockHttpServletResponse me(String accessToken) throws Exception {
        return mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andReturn().getResponse();
    }

    // ------------------------------------------------------------------ register

    @Test
    void buyerRegistersAndIsSignedIn() throws Exception {
        String email = uniqueEmail();
        MockHttpServletResponse response = client.register("Şəhla Əliyeva", email.toUpperCase(), PASSWORD);

        assertThat(response.getStatus()).isEqualTo(201);
        String body = response.getContentAsString();
        assertThat((String) JsonPath.read(body, "$.tokenType")).isEqualTo("Bearer");
        assertThat((Integer) JsonPath.read(body, "$.expiresIn")).isEqualTo(900);
        assertThat((String) JsonPath.read(body, "$.user.name")).isEqualTo("Şəhla Əliyeva");
        assertThat((String) JsonPath.read(body, "$.user.email")).isEqualTo(email);
        assertThat((String) JsonPath.read(body, "$.user.role")).isEqualTo("USER");
        assertThat(body).doesNotContain("password").doesNotContain(refreshCookie(response));

        String cookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertThat(cookie).startsWith(AuthController.REFRESH_COOKIE + "=")
                .contains("Path=/api/v1/auth", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=2592000");

        MockHttpServletResponse me = me(accessToken(response));
        assertThat(me.getStatus()).isEqualTo(200);
        assertThat((String) JsonPath.read(me.getContentAsString(), "$.email")).isEqualTo(email);

        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
        assertThat(hash).startsWith("{bcrypt}$2").doesNotContain(PASSWORD);
    }

    @Test
    void duplicateEmailIsConflictInAnyCase() throws Exception {
        String email = uniqueEmail();
        assertThat(client.register("Aysel", email, PASSWORD).getStatus()).isEqualTo(201);

        MockHttpServletResponse again = client.register("Aysel", email.toUpperCase(), PASSWORD);
        assertThat(again.getStatus()).isEqualTo(409);
        assertThat((String) JsonPath.read(again.getContentAsString(), "$.code")).isEqualTo("auth.email_taken");
        assertThat((List<String>) JsonPath.read(again.getContentAsString(), "$.errors[*].field")).containsExactly("email");
    }

    @Test
    void weakPasswordIsLocalizedValidationError() throws Exception {
        MockHttpServletResponse response = client.register("Aysel", uniqueEmail(), "abcdefgh");
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat((List<String>) JsonPath.read(response.getContentAsString(), "$.errors[*].message"))
                .containsExactly("Şifrədə ən azı bir hərf və bir rəqəm olmalıdır.");
    }

    @Test
    void passwordOverBcryptLimitIsRejected() throws Exception {
        // 40 Azerbaijani letters + digit: 41 characters but 81 bytes in UTF-8.
        MockHttpServletResponse response = client.register("Aysel", uniqueEmail(), "ə".repeat(40) + "1");
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat((List<String>) JsonPath.read(response.getContentAsString(), "$.errors[*].message"))
                .containsExactly("Şifrə çox uzundur.");
    }

    @Test
    void merchantRegistersWithPhoneAndSignsInWithLocalFormat() throws Exception {
        String phone = uniquePhone();
        MockHttpServletResponse response = client.registerMerchant("Zərgər Nigar", phone, PASSWORD);
        assertThat(response.getStatus()).isEqualTo(201);
        assertThat((String) JsonPath.read(response.getContentAsString(), "$.user.role")).isEqualTo("MERCHANT");
        assertThat((String) JsonPath.read(response.getContentAsString(), "$.user.phone")).isEqualTo(phone);
        assertThat(jdbc.queryForObject("SELECT phone_verified FROM users WHERE phone = ?", Boolean.class, phone))
                .isFalse();

        String local = "0" + phone.substring(4, 6) + " " + phone.substring(6, 9) + " " + phone.substring(9);
        MockHttpServletResponse login = client.login(local, PASSWORD);
        assertThat(login.getStatus()).isEqualTo(200);
        assertThat((String) JsonPath.read(login.getContentAsString(), "$.user.role")).isEqualTo("MERCHANT");

        assertThat(client.registerMerchant("Başqa", phone, PASSWORD).getStatus()).isEqualTo(409);
    }

    @Test
    void merchantPhoneMustBeAzerbaijaniMobile() throws Exception {
        MockHttpServletResponse response = client.registerMerchant("Zərgər", "+15551234567", PASSWORD);
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat((List<String>) JsonPath.read(response.getContentAsString(), "$.errors[*].field"))
                .containsExactly("phone");
    }

    // ------------------------------------------------------------------ login

    @Test
    void loginIssuesTokensAndUpdatesLastLogin() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);

        MockHttpServletResponse login = client.login(email.toUpperCase(), PASSWORD);
        assertThat(login.getStatus()).isEqualTo(200);
        assertThat(refreshCookie(login)).isNotBlank();
        assertThat(me(accessToken(login)).getStatus()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT last_login_at IS NOT NULL FROM users WHERE email = ?", Boolean.class,
                email)).isTrue();
    }

    @Test
    void wrongPasswordAndUnknownEmailLookTheSame() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);

        MockHttpServletResponse wrongPassword = client.login(email, "parol999");
        MockHttpServletResponse unknownEmail = new AuthTestClient(mockMvc).login(uniqueEmail(), "parol999");

        assertThat(wrongPassword.getStatus()).isEqualTo(401);
        assertThat(unknownEmail.getStatus()).isEqualTo(401);
        assertThat(wrongPassword.getContentAsString()).isEqualTo(unknownEmail.getContentAsString());
        assertThat((String) JsonPath.read(wrongPassword.getContentAsString(), "$.code"))
                .isEqualTo("auth.invalid_credentials");
        assertThat(wrongPassword.getHeader(HttpHeaders.SET_COOKIE)).isNull();
        assertThat(unknownEmail.getHeader(HttpHeaders.SET_COOKIE)).isNull();
    }

    @Test
    void demoAccountsCannotSignIn() throws Exception {
        String email = "demo-" + uniqueEmail();
        jdbc.update("""
                INSERT INTO users (email, password_hash, display_name) VALUES (?, 'DEMO-ACCOUNT-NO-LOGIN', 'Demo')
                """, email);
        MockHttpServletResponse response = client.login(email, "DEMO-ACCOUNT-NO-LOGIN");
        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void blockedAccountIsRefusedOnlyAfterTheRightPassword() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        jdbc.update("UPDATE users SET status = 'BLOCKED' WHERE email = ?", email);

        assertThat(client.login(email, "parol999").getStatus()).isEqualTo(401);
        MockHttpServletResponse right = client.login(email, PASSWORD);
        assertThat(right.getStatus()).isEqualTo(403);
        assertThat((String) JsonPath.read(right.getContentAsString(), "$.code")).isEqualTo("auth.account_blocked");
    }

    // ------------------------------------------------------------------ refresh and logout

    @Test
    void refreshRotatesTheToken() throws Exception {
        MockHttpServletResponse registered = client.register("Aysel", uniqueEmail(), PASSWORD);
        String first = refreshCookie(registered);

        MockHttpServletResponse refreshed = client.refresh(first);
        assertThat(refreshed.getStatus()).isEqualTo(200);
        String second = refreshCookie(refreshed);
        assertThat(second).isNotBlank().isNotEqualTo(first);
        assertThat(accessToken(refreshed)).isNotEqualTo(accessToken(registered));
        assertThat(me(accessToken(refreshed)).getStatus()).isEqualTo(200);

        assertThat(client.refresh(second).getStatus()).isEqualTo(200);
    }

    @Test
    void reusedRefreshTokenRevokesTheWholeFamily() throws Exception {
        String first = refreshCookie(client.register("Aysel", uniqueEmail(), PASSWORD));
        String second = refreshCookie(client.refresh(first));

        // The old token comes back (stolen copy): rejected, cookie cleared ...
        MockHttpServletResponse reuse = client.refresh(first);
        assertThat(reuse.getStatus()).isEqualTo(401);
        assertThat((String) JsonPath.read(reuse.getContentAsString(), "$.code")).isEqualTo("auth.refresh_invalid");
        assertThat(reuse.getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");

        // ... and the legitimate newer token is revoked too.
        assertThat(client.refresh(second).getStatus()).isEqualTo(401);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NOT NULL
                """, Integer.class, RefreshTokenService.hash(second))).isOne();
    }

    @Test
    void otherSessionsSurviveReuseInOneFamily() throws Exception {
        String email = uniqueEmail();
        String phoneSession = refreshCookie(client.register("Aysel", email, PASSWORD));
        String laptopSession = refreshCookie(client.login(email, PASSWORD));

        client.refresh(phoneSession);
        client.refresh(phoneSession); // reuse: only this family is revoked

        assertThat(client.refresh(laptopSession).getStatus()).isEqualTo(200);
    }

    @Test
    void refreshWithoutOrWithUnknownCookieIs401() throws Exception {
        assertThat(client.refresh(null).getStatus()).isEqualTo(401);
        assertThat(client.refresh("not-a-real-token").getStatus()).isEqualTo(401);
    }

    @Test
    void expiredRefreshTokenIs401() throws Exception {
        String token = refreshCookie(client.register("Aysel", uniqueEmail(), PASSWORD));
        jdbc.update("""
                UPDATE refresh_tokens SET created_at = now() - interval '31 days', expires_at = now() - interval '1 day'
                WHERE token_hash = ?
                """, RefreshTokenService.hash(token));
        assertThat(client.refresh(token).getStatus()).isEqualTo(401);
    }

    @Test
    void refreshOfABlockedAccountIs401() throws Exception {
        String email = uniqueEmail();
        String token = refreshCookie(client.register("Aysel", email, PASSWORD));
        jdbc.update("UPDATE users SET status = 'BLOCKED' WHERE email = ?", email);
        assertThat(client.refresh(token).getStatus()).isEqualTo(401);
    }

    @Test
    void logoutRevokesTheSessionAndClearsTheCookie() throws Exception {
        String token = refreshCookie(client.register("Aysel", uniqueEmail(), PASSWORD));

        MockHttpServletResponse logout = client.logout(token);
        assertThat(logout.getStatus()).isEqualTo(204);
        assertThat(logout.getHeader(HttpHeaders.SET_COOKIE)).contains(AuthController.REFRESH_COOKIE + "=;")
                .contains("Max-Age=0", "Path=/api/v1/auth");

        assertThat(client.refresh(token).getStatus()).isEqualTo(401);
        // Logging out twice, or without a cookie, is fine.
        assertThat(client.logout(token).getStatus()).isEqualTo(204);
        assertThat(client.logout(null).getStatus()).isEqualTo(204);
    }

    @Test
    void refreshTokensAreStoredOnlyAsHashes() throws Exception {
        String token = refreshCookie(client.register("Aysel", uniqueEmail(), PASSWORD));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE token_hash = ?", Integer.class,
                token)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE token_hash = ?", Integer.class,
                RefreshTokenService.hash(token))).isOne();
    }

    @Test
    void meOfADeletedOrBlockedAccountIs401() throws Exception {
        String email = uniqueEmail();
        String access = accessToken(client.register("Aysel", email, PASSWORD));
        jdbc.update("UPDATE users SET status = 'BLOCKED' WHERE email = ?", email);
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + access))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("auth.invalid_token"));
    }

    // ------------------------------------------------------------------ logs

    @Test
    void passwordsAndTokensNeverReachTheLogs(CapturedOutput output) throws Exception {
        String password = "Gizli" + TestData.next() + "parol";
        String email = uniqueEmail();
        MockHttpServletResponse registered = client.register("Aysel", email, password);
        String first = refreshCookie(registered);
        String second = refreshCookie(client.refresh(first));
        client.refresh(first); // reuse: logged as a warning, by ids only
        client.login(email, "wrong" + password);

        assertThat(output.getAll())
                .contains("Refresh token reuse detected")
                .doesNotContain(password)
                .doesNotContain(first)
                .doesNotContain(second)
                .doesNotContain(accessToken(registered));
    }
}
