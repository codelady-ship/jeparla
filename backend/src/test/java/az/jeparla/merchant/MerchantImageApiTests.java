package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import java.nio.charset.StandardCharsets;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Product photos (#39, #154): presigned upload into the private staging area, server-side check of the staged
 * file, publication, order and removal; limits on presigns and the cleanup of uploads never attached.
 */
@AuthIntegrationTest
class MerchantImageApiTests extends MerchantApiTestBase {

    @Autowired
    private MerchantImageProperties imageProperties;

    @Autowired
    private ImageUploadCleanupJob cleanup;

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
        // Uploaded but not attached: private, the public bucket does not serve it (#154).
        assertThat(storage.contains(key)).isFalse();
        String attach = "{\"key\": \"%s\", \"altAz\": \"Muncuqlu bilərzik, yaxından\", \"aiGenerated\": true}"
                .formatted(key);
        long imageId = id(mvc.perform(json(post(images), attach).with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(640))
                .andExpect(jsonPath("$.height").value(480))
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andReturn());
        // Checked and attached: copied to the public bucket, the staged copy is gone.
        assertThat(storage.contains(key)).isTrue();
        assertThat(storage.isStaged(key)).isFalse();
        assertThat(jdbc.queryForObject("SELECT attached_at IS NOT NULL FROM image_upload_slots WHERE storage_key = ?",
                Boolean.class, key)).isTrue();
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
        assertThat(storage.isStaged(svgKey)).isFalse();
        assertThat(storage.contains(svgKey)).isFalse();

        // A real PNG under a .jpg key is refused too: the key promised a JPEG.
        String jpegKey = uploadKey(seller, productId, "image/jpeg", 100);
        storage.put(jpegKey, png(10, 10), "image/jpeg");
        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(jpegKey)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_type"));
        assertThat(storage.isStaged(jpegKey)).isFalse();
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
        assertThat(storage.isStaged(key)).isTrue();
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

    // ------------------------------------------------------------------ upload limits (#154)

    @Test
    void openUploadsCountTowardTheEightPhotos() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String uploads = "/api/v1/merchant/products/" + productId + "/images/uploads";
        String request = "{\"contentType\": \"image/png\", \"sizeBytes\": 5000}";
        byte[] png = png(100, 100);
        String first = uploadKey(seller, productId, "image/png", png.length);
        for (int i = 1; i < MerchantImageService.MAX_IMAGES; i++) {
            uploadKey(seller, productId, "image/png", 5000);
        }
        mvc.perform(json(post(uploads), request).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.image_limit"));

        // An attached upload still takes its place (1 photo + 7 open uploads).
        storage.put(first, png, "image/png");
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/images"),
                "{\"key\": \"%s\"}".formatted(first)).with(seller.token())).andExpect(status().isCreated());
        mvc.perform(json(post(uploads), request).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.image_limit"));

        // Expired upload URLs free their places.
        jdbc.update("""
                UPDATE image_upload_slots SET created_at = now() - interval '20 minutes',
                       expires_at = now() - interval '10 minutes'
                WHERE product_id = ? AND attached_at IS NULL
                """, productId);
        mvc.perform(json(post(uploads), request).with(seller.token())).andExpect(status().isOk());
    }

    @Test
    void presignsAreRateLimitedPerSeller() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long firstProduct = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        long secondProduct = createProduct(seller, beadsProduct(category(), "Dəri bilərzik"));
        for (int i = 0; i < AuthIntegrationTest.IMAGE_UPLOAD_LIMIT; i++) {
            uploadKey(seller, i < MerchantImageService.MAX_IMAGES ? firstProduct : secondProduct, "image/png", 5000);
        }
        mvc.perform(json(post("/api/v1/merchant/products/" + secondProduct + "/images/uploads"),
                        "{\"contentType\": \"image/png\", \"sizeBytes\": 5000}").with(seller.token()))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("rate_limited"));

        // Another seller is not affected.
        Seller other = seller(SellerKind.FASHION, false);
        uploadKey(other, createProduct(other, beadsProduct(category(), "Muncuqlu bilərzik")), "image/png", 5000);
    }

    @Test
    void aStoreGetsALimitedNumberOfUploadsADay() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        // Uploads of the last 24 hours (expired, so they do not count toward the 8 photos).
        jdbc.update("""
                INSERT INTO image_upload_slots (storage_key, product_id, store_id, created_at, expires_at, discarded_at)
                SELECT 'products/' || ?::text || '/' || ?::text || '/daily-' || g || '.png', ?, ?, now() - interval '2 hours',
                       now() - interval '110 minutes', now() - interval '1 hour'
                FROM generate_series(1, ?) AS g
                """, seller.storeId(), productId, productId, seller.storeId(), imageProperties.dailyUploadsPerStore());
        String retryAfter = mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/images/uploads"),
                        "{\"contentType\": \"image/png\", \"sizeBytes\": 5000}").with(seller.token()))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("rate_limited"))
                .andReturn().getResponse().getHeader("Retry-After");
        // The oldest upload is 2 hours old: a place frees up in about 22 hours.
        assertThat(Long.parseLong(retryAfter)).isBetween(21L * 3600, 22L * 3600 + 60);

        // Uploads older than 24 hours no longer count.
        jdbc.update("UPDATE image_upload_slots SET created_at = now() - interval '25 hours',"
                + " expires_at = now() - interval '24 hours' WHERE store_id = ?", seller.storeId());
        uploadKey(seller, productId, "image/png", 5000);
    }

    @Test
    void uploadsThatAreNeverAttachedAreDeletedAndCannotBeAttachedLate() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String images = "/api/v1/merchant/products/" + productId + "/images";
        byte[] png = png(100, 100);
        String abandoned = uploadKey(seller, productId, "image/png", png.length);
        String late = uploadKey(seller, productId, "image/png", png.length);
        String kept = uploadKey(seller, productId, "image/png", png.length);
        storage.put(abandoned, png, "image/png");
        storage.put(late, png, "image/png");
        storage.put(kept, png, "image/png");
        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(kept)).with(seller.token()))
                .andExpect(status().isCreated());

        // URL expired more than the grace period ago: the file can no longer be attached.
        jdbc.update("UPDATE image_upload_slots SET created_at = now() - interval '50 minutes',"
                + " expires_at = now() - interval '40 minutes' WHERE storage_key = ?", late);
        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(late)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_missing"));
        assertThat(storage.contains(late)).isFalse();

        // Expired more than the cleanup margin ago: the staged file is deleted.
        jdbc.update("UPDATE image_upload_slots SET created_at = now() - interval '2 hours',"
                + " expires_at = now() - interval '110 minutes' WHERE storage_key = ?", abandoned);
        assertThat(cleanup.runLocked()).isPresent();
        assertThat(storage.isStaged(abandoned)).isFalse();
        assertThat(storage.contains(abandoned)).isFalse();
        assertThat(jdbc.queryForObject("SELECT discarded_at IS NOT NULL FROM image_upload_slots WHERE storage_key = ?",
                Boolean.class, abandoned)).isTrue();
        // Still within the margin: kept for now; the attached photo is untouched.
        assertThat(storage.isStaged(late)).isTrue();
        assertThat(storage.contains(kept)).isTrue();

        // A discarded upload cannot be attached, even when the file comes back.
        storage.put(abandoned, png, "image/png");
        mvc.perform(json(post(images), "{\"key\": \"%s\"}".formatted(abandoned)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_missing"));
        assertThat(storage.contains(abandoned)).isFalse();
    }
}
