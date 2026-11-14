package az.jeparla.ai;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MvcResult;

/**
 * AI model library (#130): only an admin changes it, reference photos go through the checked upload, sellers see
 * active models with photos only, and a deactivated model leaves the offer.
 */
@AuthIntegrationTest
class AiModelLibraryApiTests extends MerchantApiTestBase {

    private JwtRequestPostProcessor admin() {
        long userId = newBuyer();
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static String modelJson(String name, String audience, Boolean active) {
        return """
                {"name": "%s", "audience": "%s", "skinTone": "MEDIUM_DARK", "style": "EVENING",
                 "origin": "AI, test fixture", "sortOrder": 1%s}
                """.formatted(name, audience, active == null ? "" : ", \"active\": " + active);
    }

    private long createModel(JwtRequestPostProcessor admin, String name) throws Exception {
        return id(mvc.perform(json(post("/api/v1/admin/ai-models"), modelJson(name, "WOMEN", null)).with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true))
                .andReturn());
    }

    private void attachPhoto(JwtRequestPostProcessor admin, long modelId) throws Exception {
        byte[] png = png(800, 1000);
        MvcResult upload = mvc.perform(json(post("/api/v1/admin/ai-models/" + modelId + "/images/uploads"),
                "{\"contentType\": \"image/png\", \"sizeBytes\": %d}".formatted(png.length)).with(admin))
                .andExpect(status().isOk()).andReturn();
        String key = JsonPath.read(body(upload), "$.key");
        storage.put(key, png, "image/png");
        mvc.perform(json(post("/api/v1/admin/ai-models/" + modelId + "/images"),
                        "{\"key\": \"%s\", \"pose\": \"HAND\"}".formatted(key)).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images.length()").value(1))
                .andExpect(jsonPath("$.poses[0]").value("HAND"));
    }

    @Test
    void aModelIsOnlyForOnModelJobsAndMustBeOffered() throws Exception {
        JwtRequestPostProcessor admin = admin();
        long empty = createModel(admin, "Aygün");
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu üzük"));
        long imageId = attachPng(seller, productId);
        String job = "{\"productId\": %d, \"sourceImageId\": %d, \"kind\": \"%s\", \"modelId\": %d}";
        mvc.perform(json(post("/api/v1/merchant/ai/jobs"), job.formatted(productId, imageId, "AI_PHOTOSHOOT", empty))
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ai.model_kind"));
        mvc.perform(json(post("/api/v1/merchant/ai/jobs"), job.formatted(productId, imageId, "VIRTUAL_TRY_ON", empty))
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ai.model_inactive"));
    }

    @Test
    void onlyAnAdminChangesTheLibrary() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        mvc.perform(json(post("/api/v1/admin/ai-models"), modelJson("Nigar", "WOMEN", null)).with(seller.token()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/ai-models").with(seller.token())).andExpect(status().isForbidden());
        mvc.perform(json(post("/api/v1/admin/ai-models"), modelJson("Nigar", "UNISEX", null)).with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ai.model_audience"));
    }

    @Test
    void sellersSeeActiveModelsWithPhotosOnly() throws Exception {
        JwtRequestPostProcessor admin = admin();
        long withPhoto = createModel(admin, "Leyla");
        long withoutPhoto = createModel(admin, "Sevda");
        attachPhoto(admin, withPhoto);
        Seller seller = seller(SellerKind.FASHION, false);
        mvc.perform(get("/api/v1/merchant/ai/models").param("audience", "WOMEN").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", Matchers.hasItem((int) withPhoto)))
                .andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem((int) withoutPhoto))));

        mvc.perform(post("/api/v1/admin/ai-models/" + withPhoto + "/default").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isDefault").value(true));

        mvc.perform(json(put("/api/v1/admin/ai-models/" + withPhoto), modelJson("Leyla", "WOMEN", false)).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.isDefault").value(false));
        mvc.perform(get("/api/v1/merchant/ai/models").param("audience", "WOMEN").with(seller.token()))
                .andExpect(jsonPath("$[*].id", Matchers.not(Matchers.hasItem((int) withPhoto))));
        mvc.perform(post("/api/v1/admin/ai-models/" + withPhoto + "/default").with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ai.model_inactive"));
    }
}
