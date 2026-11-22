package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

/** The seller's store through the merchant API (#39): application, profile, dashboard, roles. */
@AuthIntegrationTest
class MerchantStoreApiTests extends MerchantApiTestBase {

    private static final String STORES = "/api/v1/merchant/stores";

    @Test
    void aMerchantAppliesOnceAndSeesItsPendingStore() throws Exception {
        long userId = newMerchant();
        mvc.perform(get("/api/v1/merchant/store").with(merchant(userId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("merchant.no_store"));

        mvc.perform(json(post(STORES), storeJson("Ayzər Zərgər", SellerKind.PRECIOUS)).with(merchant(userId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.sellerStatus").value("PENDING"))
                .andExpect(jsonPath("$.sellerKind").value("PRECIOUS"))
                .andExpect(jsonPath("$.whatsapp").value("+994501234567"))
                .andExpect(jsonPath("$.slug").value(Matchers.startsWith("ayzer-zerger")));

        mvc.perform(get("/api/v1/merchant/store").with(merchant(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ayzər Zərgər"));

        mvc.perform(json(post(STORES), storeJson("İkinci", SellerKind.PRECIOUS)).with(merchant(userId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.store_exists"));
        Integer audits = jdbc.queryForObject(
                "SELECT count(*) FROM audit_logs WHERE action = 'STORE_CREATED' AND actor_id = ?", Integer.class, userId);
        assertThat(audits).isEqualTo(1);
    }

    @Test
    void aRepeatedIdempotencyKeyReturnsTheSameStore() throws Exception {
        long userId = newMerchant();
        String key = UUID.randomUUID().toString();
        long first = id(mvc.perform(json(post(STORES), storeJson("Şəki İpək", SellerKind.FASHION))
                .header("Idempotency-Key", key).with(merchant(userId))).andExpect(status().isCreated()).andReturn());
        mvc.perform(json(post(STORES), storeJson("Şəki İpək", SellerKind.FASHION))
                        .header("Idempotency-Key", key).with(merchant(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first))
                .andExpect(jsonPath("$.sellerKind").value("FASHION"))
                .andExpect(jsonPath("$.documentsStatus").value("NONE"));
        mvc.perform(json(post(STORES), storeJson("Şəki İpək", SellerKind.FASHION))
                        .header("Idempotency-Key", UUID.randomUUID().toString()).with(merchant(userId)))
                .andExpect(status().isConflict());
        mvc.perform(json(post(STORES), storeJson("Şəki İpək", SellerKind.FASHION))
                        .header("Idempotency-Key", "not-a-uuid").with(merchant(newMerchant())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.idempotency_key"));
    }

    @Test
    void invalidApplicationsAreRejectedWithTheField() throws Exception {
        long userId = newMerchant();
        String badTaxId = storeJson("Ayzər", SellerKind.PRECIOUS).replace("1234567890", "12345");
        mvc.perform(json(post(STORES), badTaxId).with(merchant(userId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("taxId")));
        String badPhone = storeJson("Ayzər", SellerKind.PRECIOUS).replace("050 123 45 67", "12");
        mvc.perform(json(post(STORES), badPhone).with(merchant(userId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("whatsapp")));
        String noKind = storeJson("Ayzər", SellerKind.PRECIOUS).replace(", \"sellerKind\": \"PRECIOUS\"", "");
        mvc.perform(json(post(STORES), noKind).with(merchant(userId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("sellerKind")));
        mvc.perform(get("/api/v1/merchant/store").with(merchant(userId))).andExpect(status().isNotFound());
    }

    @Test
    void onlyMerchantsReachTheMerchantApi() throws Exception {
        mvc.perform(json(post(STORES), storeJson("Ayzər", SellerKind.PRECIOUS)))
                .andExpect(status().isUnauthorized());
        long buyerId = newBuyer();
        mvc.perform(json(post(STORES), storeJson("Ayzər", SellerKind.PRECIOUS)).with(buyer(buyerId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
        mvc.perform(get("/api/v1/merchant/dashboard").with(buyer(buyerId))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchant/products").with(buyer(buyerId))).andExpect(status().isForbidden());
    }

    @Test
    void theClosedGuideStaysClosedForTheStoreNotTheBrowser() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        mvc.perform(get("/api/v1/merchant/store").with(seller.token()))
                .andExpect(jsonPath("$.guideDismissed").value(false));
        mvc.perform(post("/api/v1/merchant/store/guide-dismissal").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.guideDismissed").value(true));
        // A repeat keeps the first time.
        var first = jdbc.queryForObject("SELECT guide_dismissed_at FROM stores WHERE id = ?",
                java.sql.Timestamp.class, seller.storeId());
        mvc.perform(post("/api/v1/merchant/store/guide-dismissal").with(seller.token()))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT guide_dismissed_at FROM stores WHERE id = ?",
                java.sql.Timestamp.class, seller.storeId())).isEqualTo(first);
        mvc.perform(get("/api/v1/merchant/store").with(seller.token()))
                .andExpect(jsonPath("$.guideDismissed").value(true));
    }

    @Test
    void theProfileChangesButNotTheLegalData() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Yeni Ad", SellerKind.MIXED)).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Yeni Ad"))
                .andExpect(jsonPath("$.sellerKind").value("MIXED"))
                .andExpect(jsonPath("$.taxId").value("1234567890"))
                .andExpect(jsonPath("$.social").value("https://instagram.com/test"));
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Y", SellerKind.MIXED)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("name")));
    }

    @Test
    void theRegisteredNameShowsTheSellerIdentityOnTheStorePage() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        jdbc.update("UPDATE stores SET status = 'APPROVED', approved_at = now() WHERE id = ?", seller.storeId());
        String slug = jdbc.queryForObject("SELECT slug FROM stores WHERE id = ?", String.class, seller.storeId());
        // Not provided: the page shows no identity (ET 5.3, #249).
        mvc.perform(get("/api/v1/stores/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.seller").doesNotExist());

        String named = profileJson("Test Zərgər", SellerKind.PRECIOUS).replace("\"sellerKind\"",
                "\"legalName\": \" Test Zərgər MMC \", \"sellerKind\"");
        mvc.perform(json(put("/api/v1/merchant/store"), named).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.legalName").value("Test Zərgər MMC"));
        mvc.perform(get("/api/v1/stores/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.seller.legalName").value("Test Zərgər MMC"))
                .andExpect(jsonPath("$.seller.legalType").isString())
                .andExpect(jsonPath("$.seller.taxId").value(Matchers.matchesPattern("\\d{10}")));

        // Absent keeps it, empty clears it, one character is refused.
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.PRECIOUS))
                .with(seller.token())).andExpect(jsonPath("$.legalName").value("Test Zərgər MMC"));
        mvc.perform(json(put("/api/v1/merchant/store"), named.replace(" Test Zərgər MMC ", "X"))
                .with(seller.token())).andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/v1/merchant/store"), named.replace(" Test Zərgər MMC ", ""))
                .with(seller.token())).andExpect(status().isOk()).andExpect(jsonPath("$.legalName").value(""));
        mvc.perform(get("/api/v1/stores/" + slug)).andExpect(jsonPath("$.seller").doesNotExist());
    }

    @Test
    void theOwnerSetsTheStoreServicesAndReturnTerms() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        String body = profileJson("Test Zərgər", SellerKind.PRECIOUS).replace("\"sellerKind\"",
                "\"services\": [\"ENGRAVING\", \"RESIZE\"], \"returnPolicy\": \" 14 gün ərzində \", \"sellerKind\"");
        mvc.perform(json(put("/api/v1/merchant/store"), body).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.services", Matchers.contains("RESIZE", "ENGRAVING")))
                .andExpect(jsonPath("$.returnPolicy").value("14 gün ərzində"));
        // Absent keeps them (#174).
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.PRECIOUS))
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.services", Matchers.contains("RESIZE", "ENGRAVING")));
    }

    @Test
    void theStoreDeclaresWhetherItMakesToOrder() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        String declared = profileJson("Test Zərgər", SellerKind.PRECIOUS).replace("\"sellerKind\"",
                "\"madeToOrder\": {\"offered\": true, \"days\": 10}, \"sellerKind\"");
        mvc.perform(json(put("/api/v1/merchant/store"), declared).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.madeToOrder.offered").value(true))
                .andExpect(jsonPath("$.madeToOrder.days").value(10));
        // Absent keeps the saved answer (#108).
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.PRECIOUS))
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.madeToOrder.days").value(10));
        mvc.perform(json(put("/api/v1/merchant/store"), declared.replace("\"days\": 10", "\"days\": 400"))
                        .with(seller.token()))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/v1/merchant/store"), declared.replace("\"offered\": true", "\"offered\": null"))
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.madeToOrder").value(Matchers.nullValue()));
    }

    @Test
    void theLaborAndMarkupSplitIsKeptUntilTheSellerChangesIt() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        String split = profileJson("Test Zərgər", SellerKind.PRECIOUS).replace("\"sellerKind\"",
                "\"splitLaborMarkup\": true, \"sellerKind\"");
        mvc.perform(json(put("/api/v1/merchant/store"), split).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.splitLaborMarkup").value(true));
        // Absent keeps the saved choice (#104).
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.PRECIOUS))
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.splitLaborMarkup").value(true));
    }

    @Test
    void theSellerKindCannotDropWhatTheStoreSells() throws Exception {
        Seller seller = seller(SellerKind.MIXED, false);
        createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.PRECIOUS))
                        .with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.seller_kind_conflict"));
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.FASHION))
                        .with(seller.token()))
                .andExpect(status().isOk());

        // A store whose documents were checked stays a precious-metal seller.
        Seller checked = seller(SellerKind.PRECIOUS, false);
        jdbc.update("UPDATE stores SET documents_status = 'VERIFIED' WHERE id = ?", checked.storeId());
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Test Zərgər", SellerKind.FASHION))
                        .with(checked.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.seller_kind_conflict"));
    }

    @Test
    void aBlockedStoreIsReadOnly() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        jdbc.update("UPDATE stores SET status = 'BLOCKED' WHERE id = ?", seller.storeId());
        mvc.perform(get("/api/v1/merchant/store").with(seller.token())).andExpect(status().isOk());
        mvc.perform(json(put("/api/v1/merchant/store"), profileJson("Yeni", SellerKind.PRECIOUS)).with(seller.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("merchant.store_blocked"));
        mvc.perform(json(post("/api/v1/merchant/products"), beadsProduct(category(), "Muncuq")).with(seller.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("merchant.store_blocked"));
    }

    @Test
    void theDashboardCountsProductsPerStatusAndDoesNotInventViews() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        createProduct(seller, beadsProduct(category(), "Dəri bilərzik"));
        mvc.perform(get("/api/v1/merchant/dashboard").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.views").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.whatsappClicks").value(0))
                .andExpect(jsonPath("$.whatsappClicksByQuestion.SIZE").value(0))
                .andExpect(jsonPath("$.whatsappClicksByQuestion.GENERAL").value(0))
                .andExpect(jsonPath("$.counts.DRAFT").value(2))
                .andExpect(jsonPath("$.counts.APPROVED").value(0))
                .andExpect(jsonPath("$.counts.IN_REVIEW").value(0));
    }

    @Test
    void errorsSpeakTheRequestLanguage() throws Exception {
        long userId = newMerchant();
        mvc.perform(get("/api/v1/merchant/store").with(merchant(userId)))
                .andExpect(jsonPath("$.detail").value("Hələ mağazanız yoxdur. Əvvəlcə mağaza müraciəti göndərin."));
        mvc.perform(get("/api/v1/merchant/store").header("Accept-Language", "en").with(merchant(userId)))
                .andExpect(jsonPath("$.detail").value("You do not have a store yet. Apply with a store first."));
        mvc.perform(get("/api/v1/merchant/store").header("Accept-Language", "ru").with(merchant(userId)))
                .andExpect(jsonPath("$.detail")
                        .value("У вас ещё нет магазина. Сначала отправьте заявку на магазин."));
    }

    private static String profileJson(String name, SellerKind kind) {
        return """
                {"name": "%s", "whatsapp": "+994 55 765 43 21", "city": "Gəncə", "address": "Atatürk prospekti 5",
                 "social": "https://instagram.com/test", "description": "", "openingHours": "", "sellerKind": "%s"}
                """.formatted(name, kind);
    }
}
