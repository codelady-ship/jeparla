package az.jeparla.admin;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

/**
 * What the admin lists carry for the panel (#40, frontend PR #175): the seller identity-check queue, real product
 * counts of stores, and price, fineness and first photo of products in review, null when unknown.
 */
@AuthIntegrationTest
class AdminListsApiTests extends MerchantApiTestBase {

    private static final String STORES = "/api/v1/admin/stores";
    private static final String PRODUCTS = "/api/v1/admin/products";

    /** Puts a product first in the review queue (oldest submission). */
    private void inReview(long productId) {
        jdbc.update("UPDATE products SET status = 'IN_REVIEW', submitted_at = TIMESTAMPTZ '2001-01-01 00:00:00+00'"
                + " + make_interval(secs => ?) WHERE id = ?", productId % 1000, productId);
    }

    @Test
    void theSellerCheckQueueSpansEveryStoreStatus() throws Exception {
        long adminId = newBuyer();
        Seller approved = seller(SellerKind.PRECIOUS, true);
        Seller pending = seller(SellerKind.PRECIOUS, false);
        jdbc.update("UPDATE stores SET seller_status = 'PENDING' WHERE id IN (?, ?)", approved.storeId(),
                pending.storeId());

        String approvedPath = "$.content[?(@.id == " + approved.storeId() + ")]";
        String pendingPath = "$.content[?(@.id == " + pending.storeId() + ")]";
        mvc.perform(get(STORES).param("sellerStatus", "PENDING").param("size", "100")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(approvedPath + ".sellerStatus").value("PENDING"))
                .andExpect(jsonPath(approvedPath + ".status").value("APPROVED"))
                .andExpect(jsonPath(pendingPath + ".status").value("PENDING"));
        mvc.perform(get(STORES).param("sellerStatus", "PENDING").param("status", "APPROVED").param("size", "100")
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath(approvedPath).isNotEmpty())
                .andExpect(jsonPath(pendingPath).isEmpty());
        // Without parameters: store applications, as before.
        mvc.perform(get(STORES).param("size", "100").with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.content[*].status").value(Matchers.everyItem(Matchers.is("PENDING"))));
    }

    @Test
    void storesCarryARealProductCount() throws Exception {
        long adminId = newBuyer();
        Seller seller = seller(SellerKind.PRECIOUS, false);
        mvc.perform(get(STORES + "/" + seller.storeId()).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productCount").value(0))
                .andExpect(jsonPath("$.whatsapp").value(Matchers.startsWith("+994")));
        ensureQuote(Metal.GOLD);
        long category = category();
        long fineness = fineness(Metal.GOLD);
        createProduct(seller, goldProduct(category, fineness, "100.00"));
        long removed = createProduct(seller, goldProduct(category, fineness, "120.00"));
        jdbc.update("UPDATE products SET deleted_at = now() WHERE id = ?", removed);
        mvc.perform(get(STORES + "/" + seller.storeId()).with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.productCount").value(1));
        mvc.perform(get(STORES).param("size", "100").with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$.content[?(@.id == " + seller.storeId() + ")].productCount").value(1));
    }

    @Test
    void productsInReviewShowPriceFinenessAndPhotoOrNull() throws Exception {
        long adminId = newBuyer();
        Seller seller = seller(SellerKind.MIXED, true);
        ensureQuote(Metal.GOLD);
        long fineness = fineness(Metal.GOLD);
        long gold = createProduct(seller, goldProduct(category(), fineness, "450.00"));
        long beads = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        inReview(gold);
        inReview(beads);
        String goldPath = "$.content[?(@.id == " + gold + ")]";
        String beadsPath = "$.content[?(@.id == " + beads + ")]";
        String label = jdbc.queryForObject("SELECT label FROM finenesses WHERE id = ?", String.class, fineness);
        int value = jdbc.queryForObject("SELECT value FROM finenesses WHERE id = ?", Integer.class, fineness);

        mvc.perform(get(PRODUCTS).param("size", "100").with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(goldPath + ".priceFrom.amount").value("450.00"))
                .andExpect(jsonPath(goldPath + ".priceFrom.currency").value("AZN"))
                .andExpect(jsonPath(goldPath + ".fineness").value(value))
                .andExpect(jsonPath(goldPath + ".finenessLabel").value(label))
                .andExpect(jsonPath(goldPath + ".weightGrams").value("3.250"))
                .andExpect(jsonPath(goldPath + ".metal").value("GOLD"))
                .andExpect(jsonPath(goldPath + ".names.az").value("Qızıl üzük"))
                .andExpect(jsonPath(goldPath + ".variantCount").value(1))
                // No photo yet: null, not an empty string or a placeholder.
                .andExpect(jsonPath(goldPath + ".imageUrl").value(Matchers.contains(Matchers.nullValue())))
                .andExpect(jsonPath(beadsPath + ".priceFrom.amount").value("25.00"))
                .andExpect(jsonPath(beadsPath + ".fineness").value(Matchers.contains(Matchers.nullValue())))
                .andExpect(jsonPath(beadsPath + ".metal").value(Matchers.contains(Matchers.nullValue())))
                .andExpect(jsonPath(beadsPath + ".material").value("BEADS"));

        // The seller adds a photo to the draft and sends it to review again.
        jdbc.update("UPDATE products SET status = 'DRAFT', submitted_at = NULL WHERE id = ?", gold);
        attachPng(seller, gold);
        inReview(gold);
        mvc.perform(get(PRODUCTS).param("size", "100").with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath(goldPath + ".imageUrl").value(Matchers.contains(Matchers.endsWith(".png"))))
                .andExpect(jsonPath(goldPath + ".imageAiGenerated").value(false));
    }
}
