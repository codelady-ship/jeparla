package az.jeparla.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import az.jeparla.support.TestData;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Accounts in the admin panel (#40): list with filters and search, role change and blocking, the self and
 * last-admin guards, and the audit trail.
 */
@AuthIntegrationTest
class AdminUserApiTests extends MerchantApiTestBase {

    private static final String USERS = "/api/v1/admin/users";
    private static final String BLOCK = """
            {"status": "BLOCKED", "reason": "Saxta elanlar yerləşdirir."}
            """;

    private void grantAdmin(long userId) {
        jdbc.update("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = 'ADMIN'", userId);
    }

    private long auditCount(String action, long targetId) {
        Long count = jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = ? AND target_id = ?",
                Long.class, action, String.valueOf(targetId));
        return count == null ? 0 : count;
    }

    @Test
    void onlyAdminsSeeAndChangeAccounts() throws Exception {
        long buyer = newBuyer();
        mvc.perform(get(USERS)).andExpect(status().isUnauthorized());
        mvc.perform(get(USERS).with(buyer(buyer))).andExpect(status().isForbidden());
        mvc.perform(get(USERS).with(merchant(newMerchant()))).andExpect(status().isForbidden());
        mvc.perform(json(post(USERS + "/" + buyer + "/status"), BLOCK).with(buyer(buyer)))
                .andExpect(status().isForbidden());
    }

    @Test
    void theListFiltersByRoleAndStatusAndFindsByEmailOrPhone() throws Exception {
        long adminId = newBuyer();
        long merchantId = newMerchant();
        String phone = String.format("+99477%07d", TestData.next());
        jdbc.update("UPDATE users SET phone = ? WHERE id = ?", phone, merchantId);
        String email = jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, merchantId);

        mvc.perform(get(USERS).param("q", email.toUpperCase()).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(merchantId))
                .andExpect(jsonPath("$.content[0].roles[0]").value("MERCHANT"))
                .andExpect(jsonPath("$.content[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());
        // Local spelling of the number finds the E.164 one.
        String local = "0" + phone.substring(4, 6) + " " + phone.substring(6, 9) + " " + phone.substring(9);
        mvc.perform(get(USERS).param("q", local).with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].phone").value(phone));
        mvc.perform(get(USERS).param("q", email).param("role", "USER").with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(USERS).param("q", email).param("role", "MERCHANT").param("status", "BLOCKED")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.totalElements").value(0));
        // A LIKE wildcard is a literal character, not "everything".
        mvc.perform(get(USERS).param("q", "%").with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(USERS).param("size", "101").with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.page"));
    }

    @Test
    void rolesChangeWithinTheRules() throws Exception {
        long adminId = newBuyer();
        long buyer = newBuyer();
        mvc.perform(json(post(USERS + "/" + buyer + "/role"), "{\"role\": \"MERCHANT\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles.length()").value(1))
                .andExpect(jsonPath("$.roles[0]").value("MERCHANT"));
        assertThat(auditCount("USER_ROLE_CHANGED", buyer)).isEqualTo(1);
        // The same role again: no change, no second audit entry.
        mvc.perform(json(post(USERS + "/" + buyer + "/role"), "{\"role\": \"MERCHANT\"}")
                .with(AdminTestTokens.admin(adminId))).andExpect(status().isOk());
        assertThat(auditCount("USER_ROLE_CHANGED", buyer)).isEqualTo(1);

        mvc.perform(json(post(USERS + "/" + buyer + "/role"), "{\"role\": \"ADMIN\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.role_not_assignable"));
        mvc.perform(json(post(USERS + "/" + adminId + "/role"), "{\"role\": \"MERCHANT\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.self"));

        // A store owner keeps MERCHANT.
        Seller seller = seller(SellerKind.PRECIOUS, false);
        mvc.perform(json(post(USERS + "/" + seller.userId() + "/role"), "{\"role\": \"USER\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.user_owns_store"));
        mvc.perform(get(USERS + "/" + seller.userId()).with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.storeId").value(seller.storeId()));
    }

    @Test
    void blockingEndsTheSessionsAndNeedsAReason() throws Exception {
        long adminId = newBuyer();
        AuthTestClient client = new AuthTestClient(mvc);
        String email = AuthTestClient.uniqueEmail();
        MockHttpServletResponse registered = client.register("Alıcı", email, "parol12345");
        assertThat(registered.getStatus()).isEqualTo(201);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);

        mvc.perform(json(post(USERS + "/" + userId + "/status"), "{\"status\": \"BLOCKED\", \"reason\": \"qısa\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"));
        mvc.perform(json(post(USERS + "/" + userId + "/status"), BLOCK).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BLOCKED"));
        assertThat(auditCount("USER_BLOCKED", userId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL",
                Long.class, userId)).isZero();
        assertThat(client.refresh(AuthTestClient.refreshCookie(registered)).getStatus()).isEqualTo(401);
        assertThat(client.login(email, "parol12345").getStatus()).isEqualTo(403);

        mvc.perform(json(post(USERS + "/" + userId + "/status"), "{\"status\": \"ACTIVE\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        assertThat(auditCount("USER_UNBLOCKED", userId)).isEqualTo(1);
        assertThat(client.login(email, "parol12345").getStatus()).isEqualTo(200);

        mvc.perform(json(post(USERS + "/" + adminId + "/status"), BLOCK).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.self"));
    }

    @Test
    void theLastActiveAdminIsNeitherDemotedNorBlocked() throws Exception {
        long first = newBuyer();
        long second = newBuyer();
        grantAdmin(first);
        grantAdmin(second);
        // Only these two are active admins for this test (admins of earlier tests are blocked).
        jdbc.update("""
                UPDATE users SET status = 'BLOCKED'
                WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ADMIN')
                  AND id NOT IN (?, ?)
                """, first, second);

        mvc.perform(json(post(USERS + "/" + second + "/role"), "{\"role\": \"USER\"}")
                        .with(AdminTestTokens.admin(first)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("USER"));

        // "first" is now the only active admin: another token-holder cannot remove them.
        long other = newBuyer();
        mvc.perform(json(post(USERS + "/" + first + "/role"), "{\"role\": \"USER\"}")
                        .with(AdminTestTokens.admin(other)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.last_admin"));
        mvc.perform(json(post(USERS + "/" + first + "/status"), BLOCK).with(AdminTestTokens.admin(other)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.last_admin"));
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, first))
                .isEqualTo("ACTIVE");
    }
}
