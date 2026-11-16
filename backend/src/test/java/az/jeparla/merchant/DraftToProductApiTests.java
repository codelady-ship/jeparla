package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** "Create product" from a draft photo and the bulk pricing actions (#109): own store and products only. */
@AuthIntegrationTest
class DraftToProductApiTests extends MerchantApiTestBase {

    private long draft(Seller seller) throws Exception {
        byte[] png = png(900, 1200);
        MvcResult slot = mvc.perform(json(post("/api/v1/merchant/drafts/uploads"),
                        "{\"kind\": \"PHOTO\", \"contentType\": \"image/png\", \"sizeBytes\": %d}".formatted(png.length))
                        .with(seller.token()))
                .andExpect(status().isOk()).andReturn();
        String key = JsonPath.read(body(slot), "$.key");
        storage.put(key, png, "image/png");
        MvcResult created = mvc.perform(json(post("/api/v1/merchant/drafts"),
                        "{\"key\": \"%s\", \"kind\": \"PHOTO\"}".formatted(key)).with(seller.token()))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(body(created), "$.id")).longValue();
    }

    @Test
    void aDraftPhotoBecomesAPhotoOfTheOwnProductOnce() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        Seller other = seller(SellerKind.PRECIOUS, true);
        long product = createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "500.00"));
        long foreignProduct = createProduct(other, goldProduct(category(), fineness(Metal.GOLD), "500.00"));
        long draftId = draft(seller);
        String body = "{\"draftId\": %d, \"altAz\": \"Üzük\"}".formatted(draftId);

        mvc.perform(json(post("/api/v1/merchant/products/" + foreignProduct + "/images/from-draft"), body)
                        .with(other.token()))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/v1/merchant/products/" + product + "/images/from-draft"), body)
                        .with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(900));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_images WHERE product_id = ?", Long.class,
                product)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_drafts WHERE id = ?", Long.class, draftId))
                .isZero();
        // Used up: a second call finds no draft.
        mvc.perform(json(post("/api/v1/merchant/products/" + product + "/images/from-draft"), body)
                        .with(seller.token()))
                .andExpect(status().isNotFound());
    }

    @Test
    void bulkPricingChangesModeAndLabourOfOwnProductsOnly() throws Exception {
        Seller owner = seller(SellerKind.PRECIOUS, true);
        Seller other = seller(SellerKind.PRECIOUS, true);
        long finenessId = fineness(Metal.GOLD);
        long own = createProduct(owner, goldProduct(category(), finenessId, "500.00"));
        long foreign = createProduct(other, goldProduct(category(), finenessId, "700.00"));

        mvc.perform(json(post("/api/v1/merchant/products/bulk-pricing"),
                        "{\"ids\": [%d, %d], \"pricingMode\": \"METAL_LINKED\", \"laborPerGram\": \"12.50\"}"
                                .formatted(own, foreign))
                        .with(owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ok").value(true))
                .andExpect(jsonPath("$[1].ok").value(false))
                .andExpect(jsonPath("$[1].code").value("auth.forbidden"));
        assertThat(jdbc.queryForObject("SELECT pricing_mode FROM product_variants WHERE product_id = ?",
                String.class, foreign)).isEqualTo("FIXED");

        mvc.perform(json(post("/api/v1/merchant/products/bulk-pricing"),
                        "{\"ids\": [%d], \"laborPerGram\": \"15.00\"}".formatted(own)).with(owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ok").value(true));
        assertThat(jdbc.queryForObject("SELECT labor_per_gram FROM product_variants WHERE product_id = ?",
                BigDecimal.class, own)).isEqualByComparingTo("15.00");

        mvc.perform(json(post("/api/v1/merchant/products/bulk-pricing"),
                        "{\"ids\": [%d], \"pricingMode\": \"METAL_LINKED\"}".formatted(own)).with(owner.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.bulk_labor_required"));
    }
}
