package az.jeparla.ai;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import org.junit.jupiter.api.Test;

/**
 * AI Studio with no provider (the default, #55): it says "not configured" and never creates a job or a result.
 */
@AuthIntegrationTest
class AiStudioOffApiTests extends MerchantApiTestBase {

    @Test
    void statusSaysNotConfigured() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        mvc.perform(get("/api/v1/merchant/ai/status").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.provider").value("none"))
                .andExpect(jsonPath("$.usedToday").value(0));
    }

    @Test
    void jobRequestsAnswer503AndCreateNothing() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu boyunbağı"));
        long imageId = attachPng(seller, productId);
        mvc.perform(json(post("/api/v1/merchant/ai/jobs"),
                        "{\"productId\": %d, \"sourceImageId\": %d, \"kind\": \"AI_PHOTOSHOOT\"}".formatted(productId,
                                imageId)).with(seller.token()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("ai.not_configured"));
        mvc.perform(get("/api/v1/merchant/ai/jobs").param("productId", String.valueOf(productId))
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void onlyTheOwnerAndOnlySellers() throws Exception {
        Seller owner = seller(SellerKind.FASHION, false);
        Seller other = seller(SellerKind.FASHION, false);
        long productId = createProduct(owner, beadsProduct(category(), "Muncuqlu sırğa"));
        long imageId = attachPng(owner, productId);
        String body = "{\"productId\": %d, \"sourceImageId\": %d, \"kind\": \"AI_PHOTOSHOOT\"}".formatted(productId,
                imageId);
        mvc.perform(json(post("/api/v1/merchant/ai/jobs"), body).with(other.token()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchant/ai/jobs").param("productId", String.valueOf(productId))
                        .with(other.token()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchant/ai/status").with(buyer(newBuyer())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/merchant/ai/status")).andExpect(status().isUnauthorized());
    }
}
