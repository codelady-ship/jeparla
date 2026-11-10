package az.jeparla.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.store.Store;
import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.AuthTestClient;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Complaints (#40, PLAN 5.8): guests report a product or a store (rate limited), admins list and close them, and
 * an upheld complaint notifies the seller with the admin's note only.
 */
@AuthIntegrationTest
class AdminReportApiTests extends MerchantApiTestBase {

    private static final String REPORTS = "/api/v1/admin/reports";
    private static final String COMPLAINT = """
            {"reason": "FAKE", "message": "Şəkil başqa saytdan götürülüb, Aynur 050 111 22 33"}
            """;

    private record Listed(long ownerId, long storeId, long productId) {
    }

    private Listed listedProduct() {
        return tx.execute(status -> {
            Store store = data.approvedStore(data.merchant());
            Product product = data.publicProduct(store, data.category(), data.fineness(Metal.GOLD), "199.00");
            return new Listed(store.getOwner().getId(), store.getId(), product.getId());
        });
    }

    private long reportId(String where, long id) {
        return jdbc.queryForObject("SELECT max(id) FROM product_reports WHERE " + where + " = ?", Long.class, id);
    }

    @Test
    void guestsReportAStoreOrAProductWithinTheLimit() throws Exception {
        Listed listed = listedProduct();
        String ip = AuthTestClient.nextIp();
        mvc.perform(json(post("/api/v1/stores/" + listed.storeId() + "/reports"), COMPLAINT)
                        .with(AuthTestClient.from(ip)))
                .andExpect(status().isNoContent());
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT store_id, product_id, reporter_id, status FROM product_reports WHERE id = ?",
                reportId("store_id", listed.storeId()));
        assertThat(row.get("store_id")).isEqualTo(listed.storeId());
        assertThat(row.get("product_id")).isNull();
        assertThat(row.get("reporter_id")).isNull();
        assertThat(row.get("status")).isEqualTo("OPEN");

        // A product complaint names the product's store too.
        mvc.perform(json(post("/api/v1/products/" + listed.productId() + "/reports"), COMPLAINT)
                .with(AuthTestClient.from(ip))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT store_id FROM product_reports WHERE id = ?", Long.class,
                reportId("product_id", listed.productId()))).isEqualTo(listed.storeId());

        // Not approved or unknown stores are not found; an invalid body is 400.
        long pending = seller(az.jeparla.store.SellerKind.PRECIOUS, false).storeId();
        mvc.perform(json(post("/api/v1/stores/" + pending + "/reports"), COMPLAINT).with(AuthTestClient.from(ip)))
                .andExpect(status().isNotFound());
        mvc.perform(json(post("/api/v1/stores/999999999/reports"), COMPLAINT).with(AuthTestClient.from(ip)))
                .andExpect(status().isNotFound());
        mvc.perform(json(post("/api/v1/stores/" + listed.storeId() + "/reports"), "{\"reason\": \"NOPE\"}")
                .with(AuthTestClient.from(ip))).andExpect(status().isBadRequest());

        // The report-ip limit (10 per hour by default) is shared by product and store reports.
        String busy = AuthTestClient.nextIp();
        for (int i = 0; i < 10; i++) {
            mvc.perform(json(post("/api/v1/stores/" + listed.storeId() + "/reports"), COMPLAINT)
                    .with(AuthTestClient.from(busy))).andExpect(status().isNoContent());
        }
        mvc.perform(json(post("/api/v1/products/" + listed.productId() + "/reports"), COMPLAINT)
                        .with(AuthTestClient.from(busy)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("rate_limited"));
    }

    @Test
    void adminsListAndCloseComplaintsAndTheSellerHearsOnlyTheNote() throws Exception {
        long adminId = newBuyer();
        Listed listed = listedProduct();
        String ip = AuthTestClient.nextIp();
        mvc.perform(json(post("/api/v1/products/" + listed.productId() + "/reports"), COMPLAINT)
                .with(AuthTestClient.from(ip))).andExpect(status().isNoContent());
        mvc.perform(json(post("/api/v1/stores/" + listed.storeId() + "/reports"), COMPLAINT)
                .with(AuthTestClient.from(ip))).andExpect(status().isNoContent());
        long productReport = reportId("product_id", listed.productId());
        long storeReport = reportId("store_id", listed.storeId());

        mvc.perform(get(REPORTS).with(buyer(adminId))).andExpect(status().isForbidden());
        mvc.perform(get(REPORTS).param("storeId", String.valueOf(listed.storeId()))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(storeReport))
                .andExpect(jsonPath("$.content[0].targetType").value("STORE"))
                .andExpect(jsonPath("$.content[0].product").doesNotExist())
                .andExpect(jsonPath("$.content[1].targetType").value("PRODUCT"))
                .andExpect(jsonPath("$.content[1].product.id").value(listed.productId()))
                .andExpect(jsonPath("$.content[1].store.id").value(listed.storeId()));
        mvc.perform(get(REPORTS).param("storeId", String.valueOf(listed.storeId())).param("targetType", "STORE")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.totalElements").value(1));

        String path = REPORTS + "/" + productReport + "/resolution";
        mvc.perform(json(post(path), "{\"status\": \"RESOLVED\", \"note\": \"qısa\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"));
        // The seller does not decide about complaints against their own store, even with an admin token.
        mvc.perform(json(post(path), "{\"status\": \"RESOLVED\", \"note\": \"Qiyməti və şəkli düzəldin.\"}")
                .with(AdminTestTokens.admin(listed.ownerId()))).andExpect(status().isForbidden());
        mvc.perform(json(post(path), "{\"status\": \"RESOLVED\", \"note\": \"Qiyməti və şəkli düzəldin.\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.note").value("Qiyməti və şəkli düzəldin."));
        mvc.perform(json(post(path), "{\"status\": \"DISMISSED\", \"note\": \"Yenidən baxılmır, bağlıdır.\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.report_closed"));

        Map<String, Object> notification = jdbc.queryForMap(
                "SELECT body, link FROM notifications WHERE user_id = ? AND kind = 'REPORT_RESOLVED'", listed.ownerId());
        assertThat((String) notification.get("body")).contains("Qiyməti və şəkli düzəldin.")
                .doesNotContain("Aynur").doesNotContain("050 111 22 33");
        assertThat(notification.get("link")).isEqualTo("/merchant/products");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'REPORT_RESOLVED' AND target_id = ?",
                Long.class, String.valueOf(productReport))).isOne();

        // Dismissed: closed and audited, nobody notified.
        mvc.perform(json(post(REPORTS + "/" + storeReport + "/resolution"),
                        "{\"status\": \"DISMISSED\", \"note\": \"Şikayət təsdiqlənmədi.\"}")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISMISSED"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications WHERE user_id = ?", Long.class,
                listed.ownerId())).isOne();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'REPORT_DISMISSED' AND target_id = ?",
                Long.class, String.valueOf(storeReport))).isOne();
        mvc.perform(get(REPORTS).param("storeId", String.valueOf(listed.storeId()))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }
}
