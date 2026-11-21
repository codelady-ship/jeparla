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
import az.jeparla.support.TestVideos;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/**
 * The short product video (#117): presigned upload into the private staging area, server-side check of the
 * staged file (container, codec, duration, size), publication, replacement and removal; the quota of a store
 * and the ownership of the product.
 */
@AuthIntegrationTest
class MerchantVideoApiTests extends MerchantApiTestBase {

    @Autowired
    private MerchantVideoProperties videoProperties;

    @Test
    void uploadsAreLimitedToMp4AndWebmOfEightMegabytes() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String uploads = "/api/v1/merchant/products/" + productId + "/video/uploads";
        mvc.perform(json(post(uploads), "{\"contentType\": \"video/mp4\", \"sizeBytes\": 5000}").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.method").value("PUT"))
                .andExpect(jsonPath("$.headers['Content-Type']").value("video/mp4"))
                .andExpect(jsonPath("$.maxBytes").value(8 * 1024 * 1024))
                .andExpect(jsonPath("$.key").value(Matchers.matchesPattern(
                        "products/" + seller.storeId() + "/" + productId + "/video/[0-9a-f-]{36}\\.mp4")));
        mvc.perform(json(post(uploads), "{\"contentType\": \"video/webm\", \"sizeBytes\": 5000}").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value(Matchers.endsWith(".webm")));
        for (String type : new String[] {"video/quicktime", "image/gif", "video/x-matroska"}) {
            mvc.perform(json(post(uploads), "{\"contentType\": \"%s\", \"sizeBytes\": 5000}".formatted(type))
                            .with(seller.token()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("merchant.video_type"));
        }
        mvc.perform(json(post(uploads), "{\"contentType\": \"video/mp4\", \"sizeBytes\": 8388609}")
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.video_size"));
    }

    @Test
    void aCheckedVideoIsPublishedOnceAndShownOnTheProduct() throws Exception {
        Seller seller = seller(SellerKind.FASHION, true);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        attachPng(seller, productId);
        byte[] mp4 = TestVideos.mp4("mp42", "avc1", 9500, 1080, 1920, true);
        String key = videoKey(seller, productId, "video/mp4", mp4.length);
        String video = "/api/v1/merchant/products/" + productId + "/video";

        mvc.perform(json(put(video), "{\"key\": \"%s\"}".formatted(key)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.video_missing"));

        storage.put(key, mp4, "video/mp4");
        // Uploaded but not attached: private, the public bucket does not serve it.
        assertThat(storage.contains(key)).isFalse();
        String attach = "{\"key\": \"%s\", \"aiGenerated\": true}".formatted(key);
        mvc.perform(json(put(video), attach).with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("video/mp4"))
                .andExpect(jsonPath("$.durationMs").value(9500))
                .andExpect(jsonPath("$.width").value(1080))
                .andExpect(jsonPath("$.height").value(1920))
                .andExpect(jsonPath("$.sizeBytes").value(mp4.length))
                .andExpect(jsonPath("$.aiGenerated").value(true))
                .andExpect(jsonPath("$.url").value(Matchers.endsWith(key)));
        assertThat(storage.contains(key)).isTrue();
        assertThat(storage.isStaged(key)).isFalse();
        assertThat(jdbc.queryForObject("SELECT attached_at IS NOT NULL FROM image_upload_slots WHERE storage_key = ?",
                Boolean.class, key)).isTrue();
        // A double submit is the same video, not a second one.
        mvc.perform(json(put(video), attach).with(seller.token())).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'VIDEO_ADDED'"
                + " AND target_id = ?", Integer.class, String.valueOf(productId))).isEqualTo(1);

        MvcResult product = mvc.perform(get("/api/v1/merchant/products/" + productId).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.video.durationMs").value(9500))
                .andReturn();
        String slug = JsonPath.read(body(product), "$.slug");

        // The buyer sees it with the listed product, with the AI label flag; a product without one has no key.
        jdbc.update("UPDATE products SET status = 'APPROVED', published_at = now() WHERE id = ?", productId);
        mvc.perform(get("/api/v1/products/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.video.url").value(Matchers.endsWith(key)))
                .andExpect(jsonPath("$.video.contentType").value("video/mp4"))
                .andExpect(jsonPath("$.video.durationMs").value(9500))
                .andExpect(jsonPath("$.video.aiGenerated").value(true));
        mvc.perform(get("/api/v1/products").param("store", storeSlug(seller))).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].video.url").value(Matchers.endsWith(key)));

        mvc.perform(delete(video).with(seller.token())).andExpect(status().isNoContent());
        assertThat(storage.contains(key)).isFalse();
        mvc.perform(delete(video).with(seller.token())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/products/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.video").doesNotExist());
        assertThat(jdbc.queryForObject("SELECT video_key IS NULL AND video_ai_generated IS NULL FROM products"
                + " WHERE id = ?", Boolean.class, productId)).isTrue();
    }

    @Test
    void aNewVideoOnAnApprovedProductIsReviewedAgain() throws Exception {
        Seller seller = seller(SellerKind.FASHION, true);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        attachPng(seller, productId);
        jdbc.update("UPDATE products SET status = 'APPROVED', published_at = now() WHERE id = ?", productId);
        attachVideo(seller, productId, TestVideos.webm(8000, 720, 1280), "video/webm");
        mvc.perform(get("/api/v1/merchant/products/" + productId).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_REVIEW"))
                .andExpect(jsonPath("$.video.contentType").value("video/webm"));
    }

    @Test
    void aFileThatIsNotTheVideoItClaimsIsRefusedAndDeleted() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String video = "/api/v1/merchant/products/" + productId + "/video";

        record Refused(String type, byte[] file, String code) {
        }
        Refused[] refused = {
                // Not a video at all, whatever the upload said.
                new Refused("video/mp4", "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8),
                        "merchant.video_type"),
                new Refused("video/mp4", png(10, 10), "merchant.video_type"),
                // A real WebM under a .mp4 key: the key promised an MP4.
                new Refused("video/mp4", TestVideos.webm(5000, 640, 360), "merchant.video_type"),
                // HEVC, QuickTime and Matroska play in too few browsers.
                new Refused("video/mp4", TestVideos.mp4("isom", "hvc1", 5000, 640, 360, false), "merchant.video_type"),
                new Refused("video/mp4", TestVideos.mp4("qt  ", "avc1", 5000, 640, 360, false), "merchant.video_type"),
                new Refused("video/webm", TestVideos.webm("matroska", "V_VP9", 5000.0, 640, 360),
                        "merchant.video_type"),
                // Longer than 15 seconds (with the half second of header slack), or no duration to check.
                new Refused("video/mp4", TestVideos.mp4(15_501, 640, 360), "merchant.video_duration"),
                new Refused("video/webm", TestVideos.webm(60_000, 640, 360), "merchant.video_duration"),
                new Refused("video/mp4", TestVideos.mp4(0, 640, 360), "merchant.video_duration"),
                new Refused("video/webm", TestVideos.webm("webm", "V_VP9", null, 640, 360), "merchant.video_duration"),
        };
        for (Refused r : refused) {
            // More refusals than open uploads are allowed: an upload that fails its check frees its place.
            String key = videoKey(seller, productId, r.type(), r.file().length);
            storage.put(key, r.file(), r.type());
            mvc.perform(json(put(video), "{\"key\": \"%s\"}".formatted(key)).with(seller.token()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value(r.code()));
            assertThat(storage.isStaged(key)).isFalse();
            assertThat(storage.contains(key)).isFalse();
        }
        assertThat(jdbc.queryForObject("SELECT video_key FROM products WHERE id = ?", String.class, productId))
                .isNull();
    }

    @Test
    void aStoredFileLargerThanTheLimitIsRefused() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        // The presign was for a small file; what was stored is what counts.
        String key = videoKey(seller, productId, "video/mp4", 1000);
        byte[] small = TestVideos.mp4(5000, 640, 360);
        byte[] large = new byte[8 * 1024 * 1024 + 1];
        System.arraycopy(small, 0, large, 0, small.length);
        storage.put(key, large, "video/mp4");
        mvc.perform(json(put("/api/v1/merchant/products/" + productId + "/video"), "{\"key\": \"%s\"}".formatted(key))
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.video_size"));
        assertThat(storage.isStaged(key)).isFalse();
        assertThat(storage.contains(key)).isFalse();
    }

    @Test
    void aSecondVideoReplacesTheFirstAndItsFileIsDeleted() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        String first = attachVideo(seller, productId, TestVideos.mp4(5000, 640, 360), "video/mp4");
        String second = attachVideo(seller, productId, TestVideos.webm(7000, 640, 360), "video/webm");
        assertThat(storage.contains(first)).isFalse();
        assertThat(storage.contains(second)).isTrue();
        assertThat(jdbc.queryForObject("SELECT video_key FROM products WHERE id = ?", String.class, productId))
                .isEqualTo(second);
    }

    @Test
    void anotherSellerCanNeitherUploadNorSetNorRemoveTheVideo() throws Exception {
        Seller owner = seller(SellerKind.FASHION, false);
        Seller other = seller(SellerKind.FASHION, false);
        long productId = createProduct(owner, beadsProduct(category(), "Muncuqlu bilərzik"));
        long othersProduct = createProduct(other, beadsProduct(category(), "Dəri bilərzik"));
        String base = "/api/v1/merchant/products/" + productId + "/video";
        byte[] mp4 = TestVideos.mp4(5000, 640, 360);

        mvc.perform(json(post(base + "/uploads"), "{\"contentType\": \"video/mp4\", \"sizeBytes\": %d}"
                        .formatted(mp4.length)).with(other.token()))
                .andExpect(status().isForbidden());
        // Not even with a file the other seller uploaded for a product of their own.
        String othersKey = videoKey(other, othersProduct, "video/mp4", mp4.length);
        storage.put(othersKey, mp4, "video/mp4");
        mvc.perform(json(put(base), "{\"key\": \"%s\"}".formatted(othersKey)).with(other.token()))
                .andExpect(status().isForbidden());
        // The owner cannot take a file uploaded for another product either.
        mvc.perform(json(put(base), "{\"key\": \"%s\"}".formatted(othersKey)).with(owner.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.video_key"));
        assertThat(storage.isStaged(othersKey)).isTrue();

        String key = attachVideo(owner, productId, mp4, "video/mp4");
        mvc.perform(delete(base).with(other.token())).andExpect(status().isForbidden());
        mvc.perform(delete(base).with(buyer(newBuyer()))).andExpect(status().isForbidden());
        mvc.perform(delete(base)).andExpect(status().isUnauthorized());
        assertThat(storage.contains(key)).isTrue();
        assertThat(jdbc.queryForObject("SELECT video_key FROM products WHERE id = ?", String.class, productId))
                .isEqualTo(key);

        // A product that does not exist is 404 for everybody.
        mvc.perform(json(post("/api/v1/merchant/products/999999999/video/uploads"),
                        "{\"contentType\": \"video/mp4\", \"sizeBytes\": 100}").with(other.token()))
                .andExpect(status().isNotFound());
    }

    @Test
    void aStoreHasAVideoQuota() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        int quota = videoProperties.maxPerStore();
        for (int i = 0; i < quota; i++) {
            createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik " + i));
        }
        // As if every one of them had a video already.
        jdbc.update("""
                UPDATE products SET video_key = 'products/quota/' || id || '.mp4', video_content_type = 'video/mp4',
                    video_size_bytes = 1000, video_duration_ms = 5000, video_width = 640, video_height = 360,
                    video_ai_generated = FALSE
                WHERE store_id = ?
                """, seller.storeId());
        long full = jdbc.queryForObject("SELECT min(id) FROM products WHERE store_id = ?", Long.class,
                seller.storeId());
        long productId = createProduct(seller, beadsProduct(category(), "Dəri bilərzik"));
        String uploads = "/api/v1/merchant/products/" + productId + "/video/uploads";
        String request = "{\"contentType\": \"video/mp4\", \"sizeBytes\": 5000}";

        mvc.perform(json(post(uploads), request).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.video_quota"));
        // A product that has a video may replace it: it takes no new place.
        mvc.perform(json(post("/api/v1/merchant/products/" + full + "/video/uploads"), request).with(seller.token()))
                .andExpect(status().isOk());

        // Removing a video (or deleting its product) frees a place.
        mvc.perform(delete("/api/v1/merchant/products/" + full + "/video").with(seller.token()))
                .andExpect(status().isNoContent());
        attachVideo(seller, productId, TestVideos.mp4(5000, 640, 360), "video/mp4");
    }

    @Test
    void openUploadsOfOneProductAreLimited() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        for (int i = 0; i < MerchantVideoService.MAX_OPEN_UPLOADS; i++) {
            videoKey(seller, productId, "video/mp4", 5000);
        }
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/video/uploads"),
                        "{\"contentType\": \"video/mp4\", \"sizeBytes\": 5000}").with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.video_upload_limit"));
        // Video uploads take no place of the gallery photos.
        attachPng(seller, productId);
    }

    /** Asks for a video upload URL; returns the key the API chose. */
    private String videoKey(Seller seller, long productId, String contentType, long sizeBytes) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/video/uploads"),
                "{\"contentType\": \"%s\", \"sizeBytes\": %d}".formatted(contentType, sizeBytes))
                .with(seller.token())).andExpect(status().isOk()).andReturn();
        return JsonPath.read(body(result), "$.key");
    }

    /** The whole flow: upload URL, the browser's PUT (into the fake bucket), set. Returns the key. */
    private String attachVideo(Seller seller, long productId, byte[] file, String contentType) throws Exception {
        String key = videoKey(seller, productId, contentType, file.length);
        storage.put(key, file, contentType);
        mvc.perform(json(put("/api/v1/merchant/products/" + productId + "/video"), "{\"key\": \"%s\"}".formatted(key))
                .with(seller.token())).andExpect(status().isCreated());
        return key;
    }

    private String storeSlug(Seller seller) {
        return jdbc.queryForObject("SELECT slug FROM stores WHERE id = ?", String.class, seller.storeId());
    }
}
