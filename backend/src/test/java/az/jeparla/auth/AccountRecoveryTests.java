package az.jeparla.auth;

import static az.jeparla.support.AuthTestClient.accessToken;
import static az.jeparla.support.AuthTestClient.from;
import static az.jeparla.support.AuthTestClient.refreshCookie;
import static az.jeparla.support.AuthTestClient.uniqueEmail;
import static az.jeparla.support.AuthTestClient.uniquePhone;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import az.jeparla.notification.EmailOutboxMessage;
import az.jeparla.notification.NotificationService;
import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Password reset and email verification (#131) over HTTP: one-time hashed tokens that expire, answers that do not
 * tell whether an account exists, every session ended by a reset, rate limits, audit entries and the outbox.
 */
@AuthIntegrationTest
@ExtendWith(OutputCaptureExtension.class)
class AccountRecoveryTests {

    private static final String PASSWORD = "parol123";
    private static final String NEW_PASSWORD = "parol456";
    private static final Pattern TOKEN = Pattern.compile("#token=([A-Za-z0-9_-]{43})");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private NotificationService notifications;

    private AuthTestClient client;

    @BeforeEach
    void newClient() {
        client = new AuthTestClient(mockMvc);
    }

    // ------------------------------------------------------------------ helpers

    private MockHttpServletResponse postJson(String path, String json, String ip) throws Exception {
        return mockMvc.perform(post(path).with(from(ip)).contentType(MediaType.APPLICATION_JSON).content(json))
                .andReturn().getResponse();
    }

    private MockHttpServletResponse forgot(String email) throws Exception {
        return postJson("/api/v1/auth/password/forgot", "{\"email\":\"" + email + "\"}", AuthTestClient.nextIp());
    }

    private MockHttpServletResponse reset(String token, String password) throws Exception {
        return postJson("/api/v1/auth/password/reset",
                "{\"token\":\"" + token + "\",\"password\":\"" + password + "\"}", AuthTestClient.nextIp());
    }

    private MockHttpServletResponse verify(String token) throws Exception {
        return postJson("/api/v1/auth/email/verify", "{\"token\":\"" + token + "\"}", AuthTestClient.nextIp());
    }

    private MockHttpServletResponse resend(String accessToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/email/verification").with(from(client.ip()))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)).andReturn().getResponse();
    }

    private MockHttpServletResponse me(String accessToken) throws Exception {
        return mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andReturn().getResponse();
    }

    private List<Map<String, Object>> outbox(String email) {
        return jdbc.queryForList("""
                SELECT id, subject, body, language, status, expires_at, notification_id
                FROM email_outbox WHERE to_address = ? ORDER BY id
                """, email);
    }

    /** The token in the newest email to {@code email} whose subject contains {@code subjectPart}. */
    private String tokenFromLastEmail(String email, String subjectPart) {
        List<Map<String, Object>> rows = outbox(email).stream()
                .filter(row -> ((String) row.get("subject")).contains(subjectPart)).toList();
        assertThat(rows).as("email '%s' to %s", subjectPart, email).isNotEmpty();
        Matcher matcher = TOKEN.matcher((String) rows.getLast().get("body"));
        assertThat(matcher.find()).as("link in the email").isTrue();
        return matcher.group(1);
    }

    private static String hash(String token) {
        return RefreshTokenService.hash(token);
    }

    private void expire(String token) {
        jdbc.update("""
                UPDATE account_tokens SET created_at = now() - interval '2 days', expires_at = now() - interval '1 second'
                WHERE token_hash = ?
                """, hash(token));
    }

    private long auditCount(String action, long userId) {
        return jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = ? AND target_id = ?", Long.class,
                action, String.valueOf(userId));
    }

    private long userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
    }

    // ------------------------------------------------------------------ email verification

    @Test
    void signUpSendsAVerificationLinkThatWorksOnce(CapturedOutput output) throws Exception {
        String email = uniqueEmail();
        MockHttpServletResponse registered = client.register("Aysel", email, PASSWORD);
        assertThat(registered.getStatus()).isEqualTo(201);
        assertThat((Boolean) JsonPath.read(registered.getContentAsString(), "$.user.emailVerified")).isFalse();

        List<Map<String, Object>> emails = outbox(email);
        assertThat(emails).hasSize(1);
        Map<String, Object> mail = emails.getFirst();
        assertThat(mail.get("subject")).isEqualTo("Jeparla: e-poçt ünvanınızı təsdiqləyin");
        assertThat(mail.get("language")).isEqualTo("az");
        assertThat(mail.get("expires_at")).isNotNull();
        assertThat(mail.get("notification_id")).as("email only, no in-app notification with the link").isNull();
        assertThat((String) mail.get("body")).contains("http://localhost:3000/az/verify-email#token=")
                .contains("24 saat");

        String token = tokenFromLastEmail(email, "təsdiq");
        // Only the hash is stored.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_tokens WHERE token_hash = ?", Long.class,
                hash(token))).isOne();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_tokens WHERE token_hash = ?", Long.class,
                token)).isZero();

        assertThat(verify(token).getStatus()).isEqualTo(204);
        assertThat((Boolean) JsonPath.read(me(accessToken(registered)).getContentAsString(), "$.emailVerified"))
                .isTrue();
        assertThat(auditCount("EMAIL_VERIFIED", userId(email))).isOne();

        MockHttpServletResponse again = verify(token);
        assertThat(again.getStatus()).isEqualTo(400);
        assertThat((String) JsonPath.read(again.getContentAsString(), "$.code"))
                .isEqualTo("auth.verification_token_invalid");
        assertThat(output.getAll()).doesNotContain(token);
    }

    @Test
    void expiredOrUnknownVerificationLinkIsRefused() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        String token = tokenFromLastEmail(email, "təsdiq");
        expire(token);

        MockHttpServletResponse expired = verify(token);
        MockHttpServletResponse unknown = verify("x".repeat(43));
        assertThat(expired.getStatus()).isEqualTo(400);
        assertThat(unknown.getStatus()).isEqualTo(400);
        assertThat(expired.getContentAsString()).isEqualTo(unknown.getContentAsString());
        assertThat(jdbc.queryForObject("SELECT email_verified FROM users WHERE email = ?", Boolean.class, email))
                .isFalse();
    }

    @Test
    void verificationEmailIsResentWithALimitAndNotAfterVerification() throws Exception {
        String email = uniqueEmail();
        String access = accessToken(client.register("Aysel", email, PASSWORD));

        for (int i = 0; i < 3; i++) {
            assertThat(resend(access).getStatus()).isEqualTo(202);
        }
        MockHttpServletResponse limited = resend(access);
        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getHeader(HttpHeaders.RETRY_AFTER)).isNotBlank();
        assertThat(outbox(email)).hasSize(4);

        // Every link sent works until one is used; then the others are spent too.
        String token = tokenFromLastEmail(email, "təsdiq");
        assertThat(verify(token).getStatus()).isEqualTo(204);
        String first = TOKEN.matcher((String) outbox(email).getFirst().get("body")).results().findFirst()
                .orElseThrow().group(1);
        assertThat(verify(first).getStatus()).isEqualTo(400);

        String other = uniqueEmail();
        AuthTestClient otherClient = new AuthTestClient(mockMvc);
        String otherAccess = accessToken(otherClient.register("Nigar", other, PASSWORD));
        assertThat(verify(tokenFromLastEmail(other, "təsdiq")).getStatus()).isEqualTo(204);
        MockHttpServletResponse verified = resend(otherAccess);
        assertThat(verified.getStatus()).isEqualTo(409);
        assertThat((String) JsonPath.read(verified.getContentAsString(), "$.code"))
                .isEqualTo("auth.email_already_verified");
    }

    @Test
    void phoneOnlySellerGetsNoVerificationEmail() throws Exception {
        String phone = uniquePhone();
        MockHttpServletResponse registered = client.registerMerchant("Zərgər", phone, PASSWORD);
        assertThat(registered.getStatus()).isEqualTo(201);
        long id = jdbc.queryForObject("SELECT id FROM users WHERE phone = ?", Long.class, phone);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_tokens WHERE user_id = ?", Long.class, id))
                .isZero();
        MockHttpServletResponse resent = resend(accessToken(registered));
        assertThat(resent.getStatus()).isEqualTo(409);
        assertThat((String) JsonPath.read(resent.getContentAsString(), "$.code")).isEqualTo("auth.no_email");
    }

    @Test
    void resendNeedsASignedInUser() throws Exception {
        assertThat(mockMvc.perform(post("/api/v1/auth/email/verification")).andReturn().getResponse().getStatus())
                .isEqualTo(401);
    }

    // ------------------------------------------------------------------ forgot password

    @Test
    void forgotPasswordAnswersTheSameForKnownAndUnknownAddresses() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        String unknown = uniqueEmail();

        long started = System.nanoTime();
        MockHttpServletResponse known = forgot(email.toUpperCase());
        Duration knownTime = Duration.ofNanos(System.nanoTime() - started);
        started = System.nanoTime();
        MockHttpServletResponse missing = forgot(unknown);
        Duration missingTime = Duration.ofNanos(System.nanoTime() - started);

        assertThat(known.getStatus()).isEqualTo(202);
        assertThat(missing.getStatus()).isEqualTo(202);
        assertThat(known.getContentAsString()).isEqualTo(missing.getContentAsString()).isEmpty();
        assertThat(known.getHeaderNames()).containsExactlyInAnyOrderElementsOf(missing.getHeaderNames());
        assertThat(known.getHeader(HttpHeaders.SET_COOKIE)).isNull();
        // Both wait for the floor, so the answer time does not separate them.
        Duration floor = Duration.ofMillis(Long.parseLong(AuthIntegrationTest.FORGOT_RESPONSE_FLOOR.replace("ms", "")));
        assertThat(knownTime).isGreaterThanOrEqualTo(floor);
        assertThat(missingTime).isGreaterThanOrEqualTo(floor);

        assertThat(outbox(unknown)).isEmpty();
        List<Map<String, Object>> resetEmails = outbox(email).stream()
                .filter(row -> ((String) row.get("subject")).contains("bərpa")).toList();
        assertThat(resetEmails).hasSize(1);
        assertThat((String) resetEmails.getFirst().get("body"))
                .contains("http://localhost:3000/az/reset-password#token=").contains("60 dəqiqə");
        assertThat(auditCount("PASSWORD_RESET_REQUESTED", userId(email))).isOne();
    }

    @Test
    void forgotPasswordIsLimitedPerIpAndSilentlyPerAddress() throws Exception {
        String ip = AuthTestClient.nextIp();
        for (int i = 0; i < AuthIntegrationTest.PASSWORD_FORGOT_IP_LIMIT; i++) {
            assertThat(postJson("/api/v1/auth/password/forgot", "{\"email\":\"" + uniqueEmail() + "\"}", ip)
                    .getStatus()).isEqualTo(202);
        }
        MockHttpServletResponse limited =
                postJson("/api/v1/auth/password/forgot", "{\"email\":\"" + uniqueEmail() + "\"}", ip);
        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat((String) JsonPath.read(limited.getContentAsString(), "$.code")).isEqualTo("rate_limited");

        // One address, many IPs: every answer is 202, but only 3 emails are written (no inbox flooding).
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        for (int i = 0; i < 5; i++) {
            assertThat(forgot(email).getStatus()).isEqualTo(202);
        }
        assertThat(outbox(email).stream().filter(row -> ((String) row.get("subject")).contains("bərpa")))
                .hasSize(3);
    }

    @Test
    void blockedAccountGetsNoResetEmail() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        jdbc.update("UPDATE users SET status = 'BLOCKED' WHERE email = ?", email);
        assertThat(forgot(email).getStatus()).isEqualTo(202);
        assertThat(outbox(email).stream().filter(row -> ((String) row.get("subject")).contains("bərpa"))).isEmpty();
    }

    // ------------------------------------------------------------------ reset

    @Test
    void resetSetsThePasswordOnceAndEndsEverySession() throws Exception {
        String email = uniqueEmail();
        MockHttpServletResponse registered = client.register("Aysel", email, PASSWORD);
        String firstSession = refreshCookie(registered);
        AuthTestClient otherDevice = new AuthTestClient(mockMvc);
        String secondSession = refreshCookie(otherDevice.login(email, PASSWORD));
        long id = userId(email);

        assertThat(forgot(email).getStatus()).isEqualTo(202);
        String token = tokenFromLastEmail(email, "bərpa");

        MockHttpServletResponse done = reset(token, NEW_PASSWORD);
        assertThat(done.getStatus()).isEqualTo(204);
        assertThat(done.getHeader(HttpHeaders.SET_COOKIE)).startsWith(AuthController.REFRESH_COOKIE + "=;")
                .contains("Max-Age=0");

        // Every session of every device has ended.
        assertThat(client.refresh(firstSession).getStatus()).isEqualTo(401);
        assertThat(otherDevice.refresh(secondSession).getStatus()).isEqualTo(401);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
                Long.class, id)).isZero();

        AuthTestClient fresh = new AuthTestClient(mockMvc);
        assertThat(fresh.login(email, PASSWORD).getStatus()).isEqualTo(401);
        assertThat(fresh.login(email, NEW_PASSWORD).getStatus()).isEqualTo(200);

        // Single use.
        MockHttpServletResponse again = reset(token, "parol789");
        assertThat(again.getStatus()).isEqualTo(400);
        assertThat((String) JsonPath.read(again.getContentAsString(), "$.code")).isEqualTo("auth.reset_token_invalid");

        // The link reached the inbox: the address is verified, and the action is audited.
        assertThat(jdbc.queryForObject("SELECT email_verified FROM users WHERE id = ?", Boolean.class, id)).isTrue();
        assertThat(auditCount("PASSWORD_RESET", id)).isOne();
        assertThat(jdbc.queryForObject("""
                SELECT actor_role FROM audit_logs WHERE action = 'PASSWORD_RESET' AND target_id = ?
                """, String.class, String.valueOf(id))).isEqualTo("USER");
        assertThat(jdbc.queryForObject("""
                SELECT details::text FROM audit_logs WHERE action = 'PASSWORD_RESET' AND target_id = ?
                """, String.class, String.valueOf(id))).doesNotContain(token).doesNotContain(NEW_PASSWORD);
    }

    @Test
    void oneResetSpendsTheOtherOpenLinks() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        forgot(email);
        String first = tokenFromLastEmail(email, "bərpa");
        forgot(email);
        String second = tokenFromLastEmail(email, "bərpa");
        assertThat(second).isNotEqualTo(first);

        assertThat(reset(second, NEW_PASSWORD).getStatus()).isEqualTo(204);
        assertThat(reset(first, "parol789").getStatus()).isEqualTo(400);
    }

    @Test
    void expiredResetLinkIsRefusedAndThePasswordStays() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        forgot(email);
        String token = tokenFromLastEmail(email, "bərpa");
        expire(token);

        MockHttpServletResponse expired = reset(token, NEW_PASSWORD);
        assertThat(expired.getStatus()).isEqualTo(400);
        assertThat((String) JsonPath.read(expired.getContentAsString(), "$.code"))
                .isEqualTo("auth.reset_token_invalid");
        assertThat(new AuthTestClient(mockMvc).login(email, PASSWORD).getStatus()).isEqualTo(200);
    }

    @Test
    void aVerificationLinkIsNoResetLinkAndTheReverse() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        String verification = tokenFromLastEmail(email, "təsdiq");
        assertThat(reset(verification, NEW_PASSWORD).getStatus()).isEqualTo(400);

        forgot(email);
        String resetToken = tokenFromLastEmail(email, "bərpa");
        assertThat(verify(resetToken).getStatus()).isEqualTo(400);
    }

    @Test
    void resetFollowsTheSignUpPasswordRules() throws Exception {
        MockHttpServletResponse weak = reset("x".repeat(43), "abcdefgh");
        assertThat(weak.getStatus()).isEqualTo(400);
        assertThat((List<String>) JsonPath.read(weak.getContentAsString(), "$.errors[*].message"))
                .containsExactly("Şifrədə ən azı bir hərf və bir rəqəm olmalıdır.");
    }

    @Test
    void sentAndExpiredLinksLeaveTheOutbox() throws Exception {
        String email = uniqueEmail();
        client.register("Aysel", email, PASSWORD);
        jdbc.update("""
                UPDATE email_outbox SET created_at = now() - interval '2 days', expires_at = now() - interval '1 second'
                WHERE to_address = ?
                """, email);

        notifications.redactExpiredLinks();

        Map<String, Object> mail = outbox(email).getFirst();
        assertThat(mail.get("body")).isEqualTo(EmailOutboxMessage.REDACTED_BODY);
        assertThat(mail.get("status")).isEqualTo("FAILED");
    }

    // ------------------------------------------------------------------ phone-only seller: link from an admin

    private MockHttpServletRequestBuilder adminLink(long userId, long adminId) {
        return post("/api/v1/admin/users/" + userId + "/password-reset-link")
                .with(jwt().jwt(token -> token.subject(String.valueOf(adminId)))
                        .authorities(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    @Test
    void anAdminIssuesAResetLinkForAPhoneOnlySeller() throws Exception {
        String phone = uniquePhone();
        client.registerMerchant("Zərgər Nigar", phone, PASSWORD);
        long sellerId = jdbc.queryForObject("SELECT id FROM users WHERE phone = ?", Long.class, phone);
        String adminEmail = uniqueEmail();
        new AuthTestClient(mockMvc).register("Admin", adminEmail, PASSWORD);
        long adminId = userId(adminEmail);

        MockHttpServletResponse issued = mockMvc.perform(adminLink(sellerId, adminId)).andReturn().getResponse();
        assertThat(issued.getStatus()).isEqualTo(200);
        String url = JsonPath.read(issued.getContentAsString(), "$.url");
        assertThat(url).startsWith("http://localhost:3000/az/reset-password#token=");
        assertThat(issued.getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        assertThat(jdbc.queryForObject("""
                SELECT actor_id FROM audit_logs WHERE action = 'PASSWORD_RESET_LINK_ISSUED' AND target_id = ?
                """, Long.class, String.valueOf(sellerId))).isEqualTo(adminId);
        assertThat(jdbc.queryForObject("SELECT issued_by FROM account_tokens WHERE user_id = ?", Long.class,
                sellerId)).isEqualTo(adminId);

        Matcher matcher = TOKEN.matcher(url);
        assertThat(matcher.find()).isTrue();
        assertThat(reset(matcher.group(1), NEW_PASSWORD).getStatus()).isEqualTo(204);
        assertThat(new AuthTestClient(mockMvc).login(phone, NEW_PASSWORD).getStatus()).isEqualTo(200);
        assertThat(jdbc.queryForObject("""
                SELECT details::text FROM audit_logs WHERE action = 'PASSWORD_RESET' AND target_id = ?
                """, String.class, String.valueOf(sellerId))).contains("admin_link");
    }

    @Test
    void onlyAdminsIssueLinksAndNeverForAVerifiedEmail() throws Exception {
        String email = uniqueEmail();
        MockHttpServletResponse registered = client.register("Aysel", email, PASSWORD);
        long id = userId(email);
        verify(tokenFromLastEmail(email, "təsdiq"));

        assertThat(mockMvc.perform(post("/api/v1/admin/users/" + id + "/password-reset-link")).andReturn()
                .getResponse().getStatus()).isEqualTo(401);
        assertThat(mockMvc.perform(post("/api/v1/admin/users/" + id + "/password-reset-link")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(registered))).andReturn().getResponse()
                .getStatus()).isEqualTo(403);

        String adminEmail = uniqueEmail();
        new AuthTestClient(mockMvc).register("Admin", adminEmail, PASSWORD);
        MockHttpServletResponse refused = mockMvc.perform(adminLink(id, userId(adminEmail))).andReturn().getResponse();
        assertThat(refused.getStatus()).isEqualTo(409);
        assertThat((String) JsonPath.read(refused.getContentAsString(), "$.code"))
                .isEqualTo("auth.reset_link_not_allowed");
        assertThat(mockMvc.perform(adminLink(Long.MAX_VALUE, userId(adminEmail))).andReturn().getResponse()
                .getStatus()).isEqualTo(404);
    }
}
