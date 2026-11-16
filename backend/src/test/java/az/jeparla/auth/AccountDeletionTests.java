package az.jeparla.auth;

import static az.jeparla.support.AuthTestClient.accessToken;
import static az.jeparla.support.AuthTestClient.uniqueEmail;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Self-service account deletion (#249): the password again, the account and its private data go, a seller
 * declaration keeps the signer's label (docs/legal/analysis.md risk 7), store owners and admins are refused.
 */
@AuthIntegrationTest
class AccountDeletionTests {

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

    private ResultActions deleteAccount(String token, String password) throws Exception {
        return mockMvc.perform(delete("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"password\": \"" + password + "\"}"));
    }

    private long userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
    }

    @Test
    void aBuyerDeletesTheAccountWithThePassword() throws Exception {
        String email = uniqueEmail();
        String token = accessToken(client.register("Silinən Alıcı", email, PASSWORD));
        long id = userId(email);

        deleteAccount(token, "yanlis-parol").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("auth.wrong_password"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ?", Integer.class, id)).isOne();

        deleteAccount(token, PASSWORD).andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE user_id = ?", Integer.class, id))
                .isZero();
        // The audit row says that it happened, without the name or the email.
        assertThat(jdbc.queryForMap("SELECT actor_id, actor_label, ip_address FROM audit_logs"
                + " WHERE action = 'ACCOUNT_DELETED' AND target_id = ?", String.valueOf(id)))
                .containsEntry("actor_id", null).containsEntry("actor_label", "deleted account")
                .containsEntry("ip_address", null);
        // The old access token no longer opens the account.
        mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aDeclarationKeepsTheSignersLabel() throws Exception {
        String email = uniqueEmail();
        String token = accessToken(client.register("Bəyanat İmzalayan", email, PASSWORD));
        long id = userId(email);
        long owner = jdbc.queryForObject("""
                INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Owner') RETURNING id
                """, Long.class, uniqueEmail());
        long store = jdbc.queryForObject("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id)
                VALUES (?, ?, 'Store', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890') RETURNING id
                """, Long.class, owner, "deletion-store-" + id);
        long declaration = jdbc.queryForObject("""
                INSERT INTO seller_declarations (user_id, user_label, store_id, text_version, language, text,
                                                 ip_address, confirmed_at)
                VALUES (?, ?, ?, 'test-1', 'az', 'Təsdiq edirəm', '203.0.113.7', now()) RETURNING id
                """, Long.class, id, "Bəyanat İmzalayan <" + email + ">", store);

        deleteAccount(token, PASSWORD).andExpect(status().isNoContent());

        assertThat(jdbc.queryForMap("SELECT user_id, user_label FROM seller_declarations WHERE id = ?", declaration))
                .containsEntry("user_id", null)
                .containsEntry("user_label", "Bəyanat İmzalayan <" + email + ">");
    }

    @Test
    void aStoreOwnerIsSentToSupport() throws Exception {
        String email = uniqueEmail();
        String token = accessToken(client.register("Mağaza Sahibi", email, PASSWORD));
        long id = userId(email);
        jdbc.update("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id)
                VALUES (?, ?, 'Store', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890')
                """, id, "owner-store-" + id);

        deleteAccount(token, PASSWORD).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("auth.account_owns_store"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ?", Integer.class, id)).isOne();
    }

    @Test
    void aGuestCannotDelete() throws Exception {
        mockMvc.perform(delete("/api/v1/auth/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\": \"x\"}")).andExpect(status().isUnauthorized());
    }
}
