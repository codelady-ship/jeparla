package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** Drafts from photos and catalog PDFs (#129, #109): private files, own store only, PDF deleted after reading. */
@AuthIntegrationTest
class DraftApiTests extends MerchantApiTestBase {

    private static final String DRAFTS = "/api/v1/merchant/drafts";

    private String presign(Seller seller, String kind, String type, long size) throws Exception {
        MvcResult result = mvc.perform(json(post(DRAFTS + "/uploads"),
                        "{\"kind\": \"%s\", \"contentType\": \"%s\", \"sizeBytes\": %d}".formatted(kind, type, size))
                        .with(seller.token()))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(body(result), "$.key");
    }

    @Test
    void aCameraPhotoBecomesAPrivateDraftOfTheOwnStoreOnly() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        Seller other = seller(SellerKind.PRECIOUS, false);
        byte[] png = png(900, 1200);
        String key = presign(seller, "CAMERA", "image/png", png.length);
        assertThat(key).startsWith("drafts/" + seller.storeId() + "/");
        storage.put(key, png, "image/png");

        // Another seller cannot claim the upload.
        mvc.perform(json(post(DRAFTS), "{\"key\": \"%s\", \"kind\": \"CAMERA\"}".formatted(key)).with(other.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_key"));
        MvcResult created = mvc.perform(json(post(DRAFTS), "{\"key\": \"%s\", \"kind\": \"CAMERA\"}".formatted(key))
                        .with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("CAMERA"))
                .andExpect(jsonPath("$.width").value(900))
                .andReturn();
        int id = JsonPath.read(body(created), "$.id");
        assertThat(storage.isPrivate(key)).isTrue();
        assertThat(storage.contains(key)).isFalse();

        mvc.perform(get(DRAFTS).with(other.token())).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete(DRAFTS + "/" + id).with(other.token())).andExpect(status().isForbidden());
        mvc.perform(delete(DRAFTS + "/" + id).with(seller.token())).andExpect(status().isNoContent());
        assertThat(storage.isPrivate(key)).isFalse();
    }

    @Test
    void aCatalogPdfGivesOneDraftPerPhotoWithSuggestions() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        byte[] pdf = CatalogPdfTests.catalog(2);
        String key = presign(seller, "PDF", "application/pdf", pdf.length);
        storage.put(key, pdf, "application/pdf");

        mvc.perform(json(post(DRAFTS + "/pdf"), "{\"key\": \"%s\"}".formatted(key)).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.limited").value(false))
                .andExpect(jsonPath("$.drafts.length()").value(2))
                .andExpect(jsonPath("$.drafts[0].pdfPage").value(1))
                .andExpect(jsonPath("$.drafts[0].suggestedName").value("Lale ring"))
                .andExpect(jsonPath("$.drafts[0].suggestedPrice").value("1250.50"))
                .andExpect(jsonPath("$.drafts[0].suggestedWeight").value("4.200"));
        assertThat(storage.isStaged(key)).isFalse();
        assertThat(jdbc.queryForObject("SELECT suggested_price::text FROM product_drafts WHERE store_id = ?"
                + " AND pdf_page = 1", String.class, seller.storeId())).isEqualTo("1250.50");

        String notPdf = presign(seller, "PDF", "application/pdf", 10);
        storage.put(notPdf, "hello word".getBytes(), "application/pdf");
        mvc.perform(json(post(DRAFTS + "/pdf"), "{\"key\": \"%s\"}".formatted(notPdf)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.pdf_invalid"));
        mvc.perform(json(post(DRAFTS + "/uploads"),
                        "{\"kind\": \"PDF\", \"contentType\": \"application/pdf\", \"sizeBytes\": 30000000}")
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.pdf_size"));
        mvc.perform(get(DRAFTS).with(buyer(newBuyer()))).andExpect(status().isForbidden());
    }
}
