package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

/** Product photos (#39): presigned upload, server-side check of the stored file, order and removal. */
@AuthIntegrationTest
class MerchantImageApiTests extends MerchantApiTestBase {

    @Test
    void uploadsAreLimitedToSmallJpegPngAndWebp() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String uploads = "/api/v1/merchant/products/" + productId + "/images/uploads";
        mvc.perform(json(post(uploads), "{\"contentType\": \"image/png\", \"sizeBytes\": 5000}").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.method").value("PUT"))
                .andExpect(jsonPath("$.headers['Content-Type']").value("image/png"))
                .andExpect(jsonPath("$.key").value(Matchers.matchesPattern(
                        "products/" + seller.storeId() + "/" + productId + "/[0-9a-f-]{36}\\.png")));
        mvc.perform(json(post(uploads), "{\"contentType\": \"image/svg+xml\", \"sizeBytes\": 5000}")
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_type"));
        mvc.perform(json(post(uploads), "{\"contentType\": \"image/jpeg\", \"sizeBytes\": 15728641}")
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_size"));
    }

    @Test
    void aStoredPngIsAttachedOnceWithItsRealSize() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        byte[] png = png(640, 480);
        String key = uploadKey(seller, productId, "image/png", png.length);
        String images = "/api/v1/merchant/products/" + productId + "/images";

        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(key)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_missing"));

        storage.put(key, png, "image/png");
        String attach = "{\"key\": \"%s\", \"altAz\": \"Muncuqlu bilərzik, yaxından\", \"aiGenerated\": true}"
                .formatted(key);
        long imageId = id(mvc.perform(json(post(images), attach).with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(640))
                .andExpect(jsonPath("$.height").value(480))
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andReturn());
        mvc.perform(json(post(images), attach).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) imageId));
        assertThat(jdbc.queryForObject("SELECT ai_generated FROM product_images WHERE id = ?", Boolean.class, imageId))
                .isTrue();
    }

    @Test
    void aFileThatIsNotTheImageItClaimsIsRefusedAndDeleted() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String images = "/api/v1/merchant/products/" + productId + "/images";

        String svgKey = uploadKey(seller, productId, "image/png", 100);
        storage.put(svgKey, "<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>".getBytes(StandardCharsets.UTF_8),
                "image/png");
        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(svgKey)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_type"));
        assertThat(storage.contains(svgKey)).isFalse();

        // A real PNG under a .jpg key is refused too: the key promised a JPEG.
        String jpegKey = uploadKey(seller, productId, "image/jpeg", 100);
        storage.put(jpegKey, png(10, 10), "image/jpeg");
        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(jpegKey)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_type"));
        assertThat(storage.contains(jpegKey)).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_images WHERE product_id = ?", Integer.class,
                productId)).isZero();
    }

    @Test
    void keysOfAnotherProductAreRefused() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long first = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        long second = createProduct(seller, beadsProduct(category(), "Dəri bilərzik"));
        byte[] png = png(100, 100);
        String key = uploadKey(seller, first, "image/png", png.length);
        storage.put(key, png, "image/png");
        for (String foreign : new String[] {key, "products/" + seller.storeId() + "/" + second + "/../x.png",
                "demo/ring.png"}) {
            mvc.perform(json(post("/api/v1/merchant/products/" + second + "/images"),
                            "{\"key\": \"%s\"}".formatted(foreign)).with(seller.token()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("merchant.image_key"));
        }
        assertThat(storage.contains(key)).isTrue();
    }

    @Test
    void photosAreReorderedAndRemovedWithTheirFiles() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        long cover = attachPng(seller, productId);
        long second = attachPng(seller, productId);
        String base = "/api/v1/merchant/products/" + productId;

        mvc.perform(json(put(base + "/images/order"), "{\"imageIds\": [%d, %d]}".formatted(second, cover))
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images[0].id").value((int) second))
                .andExpect(jsonPath("$.images[1].id").value((int) cover));
        mvc.perform(json(put(base + "/images/order"), "{\"imageIds\": [%d]}".formatted(second)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_order"));

        String key = jdbc.queryForObject("SELECT storage_key FROM product_images WHERE id = ?", String.class, cover);
        assertThat(storage.contains(key)).isTrue();
        mvc.perform(delete(base + "/images/" + cover).with(seller.token())).andExpect(status().isNoContent());
        assertThat(storage.contains(key)).isFalse();
        mvc.perform(delete(base + "/images/" + cover).with(seller.token())).andExpect(status().isNotFound());
        mvc.perform(get(base).with(seller.token()))
                .andExpect(jsonPath("$.images.length()").value(1))
                .andExpect(jsonPath("$.images[0].id").value((int) second));
    }

    @Test
    void aNewPhotoSendsAnApprovedProductBackToReviewAndTheLastOneStays() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long productId = createProduct(seller, goldProduct(category(), fineness(az.jeparla.product.Metal.GOLD),
                "300.00"));
        long only = attachPng(seller, productId);
        jdbc.update("UPDATE products SET status = 'APPROVED', published_at = now() WHERE id = ?", productId);
        mvc.perform(delete("/api/v1/merchant/products/" + productId + "/images/" + only).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.last_image"));
        attachPng(seller, productId);
        mvc.perform(get("/api/v1/merchant/products/" + productId).with(seller.token()))
                .andExpect(jsonPath("$.status").value("IN_REVIEW"));
    }
}
