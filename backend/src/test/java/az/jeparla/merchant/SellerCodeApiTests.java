package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerCode;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

/**
 * Seller code of conduct (#107): accepted in the wizard or in the cabinet, valid for a year, required to send a
 * product to review, kept in the history and the audit log, and shown on the store page.
 */
@AuthIntegrationTest
class SellerCodeApiTests extends MerchantApiTestBase {

    private static final String ACCEPTED = "\"codeAccepted\": true";

    /** An approved, verified seller whose application did not accept the code. */
    private Seller sellerWithoutCode() throws Exception {
        long userId = newMerchant();
        long storeId = id(mvc.perform(json(post("/api/v1/merchant/stores"),
                        storeJson("Kodeksiz Zərgər", SellerKind.PRECIOUS).replace(ACCEPTED, "\"codeAccepted\": false"))
                        .with(merchant(userId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.codeVersion").value(SellerCode.CURRENT_VERSION))
                .andExpect(jsonPath("$.codeAcceptedAt").value(Matchers.nullValue()))
                .andReturn());
        jdbc.update("UPDATE stores SET status = 'APPROVED', approved_at = now(), seller_status = 'VERIFIED'"
                + " WHERE id = ?", storeId);
        return new Seller(userId, storeId);
    }

    private long readyProduct(Seller seller) throws Exception {
        ensureQuote(Metal.GOLD);
        long product = createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "450.00"));
        attachPng(seller, product);
        return product;
    }

    private org.springframework.test.web.servlet.ResultActions submit(Seller seller, long product) throws Exception {
        return mvc.perform(json(patch("/api/v1/merchant/products/" + product + "/status"),
                "{\"status\": \"IN_REVIEW\"}").with(seller.token()));
    }

    @Test
    void withoutTheCodeNoProductGoesToReview() throws Exception {
        Seller seller = sellerWithoutCode();
        long product = readyProduct(seller);

        submit(seller, product).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.code_not_accepted"));

        mvc.perform(post("/api/v1/merchant/store/code-acceptance").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.codeAcceptedAt").isString())
                .andExpect(jsonPath("$.codeValidUntil").isString());
        submit(seller, product).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_REVIEW"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM store_code_acceptances WHERE store_id = ? AND version = ?",
                Integer.class, seller.storeId(), SellerCode.CURRENT_VERSION)).isOne();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'SELLER_CODE_ACCEPTED'"
                + " AND target_id = ?", Integer.class, String.valueOf(seller.storeId()))).isOne();
    }

    @Test
    void theWizardAcceptanceCountsAndRunsOutAfterAYear() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        mvc.perform(get("/api/v1/merchant/store").with(seller.token()))
                .andExpect(jsonPath("$.codeAcceptedAt").isString());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM store_code_acceptances WHERE store_id = ?",
                Integer.class, seller.storeId())).isOne();

        jdbc.update("UPDATE stores SET code_accepted_at = now() - interval '366 days' WHERE id = ?", seller.storeId());
        long product = readyProduct(seller);
        submit(seller, product).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.code_not_accepted"));
    }

    @Test
    void theStorePageShowsTheAcceptanceDay() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        String slug = jdbc.queryForObject("SELECT slug FROM stores WHERE id = ?", String.class, seller.storeId());
        mvc.perform(get("/api/v1/stores/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.codeAcceptedOn").value(Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2}")));

        jdbc.update("UPDATE stores SET code_version = NULL, terms_version = NULL, code_accepted_at = NULL WHERE id = ?",
                seller.storeId());
        mvc.perform(get("/api/v1/stores/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.codeAcceptedOn").doesNotExist());
    }

    @Test
    void bothVersionsAreStoredAndAnOlderVersionMustBeAcceptedAgain() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        assertThat(jdbc.queryForMap("SELECT version, terms_version FROM store_code_acceptances WHERE store_id = ?",
                seller.storeId()))
                .containsEntry("version", SellerCode.CURRENT_VERSION)
                .containsEntry("terms_version", SellerCode.CURRENT_TERMS_VERSION);
        assertThat(jdbc.queryForObject("SELECT details ->> 'termsVersion' FROM audit_logs"
                + " WHERE action = 'SELLER_CODE_ACCEPTED' AND target_id = ?", String.class,
                String.valueOf(seller.storeId()))).isEqualTo(String.valueOf(SellerCode.CURRENT_TERMS_VERSION));
        long product = readyProduct(seller);

        // Accepted before code v2 and the versioned terms (V58): a recent date is not enough.
        jdbc.update("UPDATE stores SET code_version = 1, terms_version = NULL, code_accepted_at = now() WHERE id = ?",
                seller.storeId());
        mvc.perform(get("/api/v1/merchant/store").with(seller.token()))
                .andExpect(jsonPath("$.codeAcceptedAt").value(Matchers.nullValue()));
        submit(seller, product).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.code_not_accepted"));

        // The current code with older terms is not enough either.
        jdbc.update("UPDATE stores SET code_version = ?, terms_version = NULL WHERE id = ?",
                SellerCode.CURRENT_VERSION, seller.storeId());
        submit(seller, product).andExpect(status().isConflict());

        mvc.perform(post("/api/v1/merchant/store/code-acceptance").with(seller.token()))
                .andExpect(status().isOk());
        submit(seller, product).andExpect(status().isOk());
    }

    @Test
    void onlySellersAccept() throws Exception {
        mvc.perform(post("/api/v1/merchant/store/code-acceptance").with(buyer(newBuyer())))
                .andExpect(status().isForbidden());
    }
}
