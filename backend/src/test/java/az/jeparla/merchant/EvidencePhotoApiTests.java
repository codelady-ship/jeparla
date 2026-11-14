package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Hallmark and label photos (#106): the same private staging and file check as gallery photos, one photo of each
 * kind per product, ownership, the admin check with its audit entry, and the public product page.
 */
@AuthIntegrationTest
class EvidencePhotoApiTests extends MerchantApiTestBase {

    private static JwtRequestPostProcessor admin(long userId) {
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private long goldProduct(Seller seller) throws Exception {
        return createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "640.00"));
    }

    private String evidenceKey(Seller seller, long productId, String kind, byte[] png) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/evidence/" + kind
                        + "/uploads"), "{\"contentType\": \"image/png\", \"sizeBytes\": %d}".formatted(png.length))
                .with(seller.token())).andExpect(status().isOk()).andReturn();
        return JsonPath.read(body(result), "$.key");
    }

    /** Upload URL, the browser's PUT, then the attach; returns the photo id. */
    private long attachEvidence(Seller seller, long productId, String kind) throws Exception {
        byte[] png = png(1200, 900);
        String key = evidenceKey(seller, productId, kind, png);
        storage.put(key, png, "image/png");
        return id(mvc.perform(json(put("/api/v1/merchant/products/" + productId + "/evidence/" + kind),
                "{\"key\": \"%s\"}".formatted(key)).with(seller.token())).andExpect(status().isCreated()).andReturn());
    }

    private String keyOf(long photoId) {
        return jdbc.queryForObject("SELECT storage_key FROM product_evidence_photos WHERE id = ?", String.class,
                photoId);
    }

    @Test
    void aHallmarkPhotoIsCheckedLikeAGalleryPhotoAndKeptApart() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long productId = goldProduct(seller);
        byte[] png = png(1200, 900);
        String key = evidenceKey(seller, productId, "HALLMARK", png);
        assertThat(key).matches("products/" + seller.storeId() + "/" + productId + "/evidence/[0-9a-f-]{36}\\.png");
        String evidence = "/api/v1/merchant/products/" + productId + "/evidence/HALLMARK";
        String attach = "{\"key\": \"%s\"}".formatted(key);

        mvc.perform(json(put(evidence), attach).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_missing"));
        storage.put(key, png, "image/png");
        assertThat(storage.contains(key)).isFalse();
        // An evidence upload is not a gallery photo, and the label is not the hallmark.
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/images"), attach).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_key"));
        mvc.perform(json(put("/api/v1/merchant/products/" + productId + "/evidence/TAG"), attach)
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_missing"));

        long photoId = id(mvc.perform(json(put(evidence), attach).with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("HALLMARK"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.width").value(1200))
                .andExpect(jsonPath("$.checkNote").value(Matchers.nullValue()))
                .andReturn());
        assertThat(storage.contains(key)).isTrue();
        assertThat(storage.isStaged(key)).isFalse();
        mvc.perform(json(put(evidence), attach).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) photoId));

        mvc.perform(get("/api/v1/merchant/products/" + productId).with(seller.token()))
                .andExpect(jsonPath("$.images").isEmpty())
                .andExpect(jsonPath("$.evidencePhotos.length()").value(1))
                .andExpect(jsonPath("$.evidencePhotos[0].id").value((int) photoId));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'EVIDENCE_PHOTO_ADDED'"
                + " AND target_id = ?", Integer.class, String.valueOf(productId))).isOne();
        // The hallmark photo is not a gallery photo: a product with only evidence cannot be submitted.
        jdbc.update("UPDATE stores SET status = 'APPROVED', approved_at = now(), seller_status = 'VERIFIED'"
                + " WHERE id = ?", seller.storeId());
        mvc.perform(json(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                        "/api/v1/merchant/products/" + productId + "/status"), "{\"status\": \"IN_REVIEW\"}")
                        .with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.images_required"));
    }

    @Test
    void aNewPhotoReplacesTheOldOneOfItsKind() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long productId = goldProduct(seller);
        long first = attachEvidence(seller, productId, "HALLMARK");
        String firstKey = keyOf(first);
        long label = attachEvidence(seller, productId, "TAG");

        long second = attachEvidence(seller, productId, "HALLMARK");

        assertThat(second).isNotEqualTo(first);
        assertThat(storage.contains(firstKey)).isFalse();
        assertThat(jdbc.queryForList("SELECT kind FROM product_evidence_photos WHERE product_id = ? ORDER BY kind",
                String.class, productId)).containsExactly("HALLMARK", "TAG");
        assertThat(jdbc.queryForObject("SELECT details->>'replacedPhotoId' FROM audit_logs"
                + " WHERE action = 'EVIDENCE_PHOTO_ADDED' AND details->>'photoId' = ?", String.class,
                String.valueOf(second))).isEqualTo(String.valueOf(first));

        String labelKey = keyOf(label);
        mvc.perform(delete("/api/v1/merchant/products/" + productId + "/evidence/TAG").with(seller.token()))
                .andExpect(status().isNoContent());
        assertThat(storage.contains(labelKey)).isFalse();
        mvc.perform(delete("/api/v1/merchant/products/" + productId + "/evidence/TAG").with(seller.token()))
                .andExpect(status().isNotFound());
    }

    @Test
    void aFashionProductHasALabelButNoHallmark() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/evidence/HALLMARK/uploads"),
                        "{\"contentType\": \"image/png\", \"sizeBytes\": 100}").with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.hallmark_precious_only"));
        attachEvidence(seller, productId, "TAG");
    }

    @Test
    void openEvidenceUploadsAreLimitedPerKind() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long productId = goldProduct(seller);
        String uploads = "/api/v1/merchant/products/" + productId + "/evidence/TAG/uploads";
        String request = "{\"contentType\": \"image/jpeg\", \"sizeBytes\": 100}";
        for (int i = 0; i < MerchantImageService.MAX_OPEN_EVIDENCE_UPLOADS; i++) {
            mvc.perform(json(post(uploads), request).with(seller.token())).andExpect(status().isOk());
        }
        mvc.perform(json(post(uploads), request).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.evidence_upload_limit"));
        // Other kinds and the gallery keep their own places.
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/evidence/HALLMARK/uploads"), request)
                .with(seller.token())).andExpect(status().isOk());
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/images/uploads"), request)
                .with(seller.token())).andExpect(status().isOk());
        mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/evidence/STAMP/uploads"), request)
                .with(seller.token())).andExpect(status().isBadRequest());
    }

    @Test
    void onlyTheOwnerChangesTheEvidenceOfAProduct() throws Exception {
        Seller owner = seller(SellerKind.PRECIOUS, false);
        Seller other = seller(SellerKind.PRECIOUS, false);
        long productId = goldProduct(owner);
        attachEvidence(owner, productId, "HALLMARK");
        String base = "/api/v1/merchant/products/" + productId + "/evidence/HALLMARK";
        mvc.perform(json(post(base + "/uploads"), "{\"contentType\": \"image/png\", \"sizeBytes\": 100}")
                .with(other.token())).andExpect(status().isForbidden());
        mvc.perform(json(put(base), "{\"key\": \"x\"}").with(other.token())).andExpect(status().isForbidden());
        mvc.perform(delete(base).with(other.token())).andExpect(status().isForbidden());
        mvc.perform(delete(base).with(buyer(newBuyer()))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/evidence-photos").with(owner.token())).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_evidence_photos WHERE product_id = ?",
                Integer.class, productId)).isOne();
    }

    @Test
    void anAdminChecksThePhotoAndThePublicPageShowsIt() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long productId = goldProduct(seller);
        attachPng(seller, productId);
        jdbc.update("UPDATE products SET status = 'APPROVED', submitted_at = now(), published_at = now() WHERE id = ?",
                productId);
        long hallmark = attachEvidence(seller, productId, "HALLMARK");
        // A new photo on a listed product is reviewed before the public sees it.
        assertThat(jdbc.queryForObject("SELECT status FROM products WHERE id = ?", String.class, productId))
                .isEqualTo("IN_REVIEW");
        long label = attachEvidence(seller, productId, "TAG");
        long adminId = newBuyer();

        mvc.perform(get("/api/v1/admin/evidence-photos?size=100").with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == %d)].productId".formatted(hallmark))
                        .value(Matchers.contains((int) productId)))
                .andExpect(jsonPath("$.content[?(@.id == %d)].finenesses[0]".formatted(hallmark))
                        .value(Matchers.contains(585)))
                .andExpect(jsonPath("$.content[?(@.id == %d)].weightsGrams[0]".formatted(hallmark))
                        .value(Matchers.contains("3.250")));
        mvc.perform(get("/api/v1/admin/products/" + productId + "/evidence-photos").with(admin(adminId)))
                .andExpect(jsonPath("$.length()").value(2));

        String check = "/api/v1/admin/evidence-photos/%d/check";
        mvc.perform(json(post(check.formatted(label)), "{\"decision\": \"REJECTED\", \"reason\": \"bulanıq\"}")
                        .with(admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"));
        mvc.perform(json(post(check.formatted(label)), "{\"decision\": \"PENDING\"}").with(admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.status_invalid"));
        mvc.perform(json(post(check.formatted(hallmark)), "{\"decision\": \"VERIFIED\"}").with(seller.token()))
                .andExpect(status().isForbidden());
        mvc.perform(json(post(check.formatted(hallmark)), "{\"decision\": \"VERIFIED\"}").with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.checkedAt").isNotEmpty());
        mvc.perform(json(post(check.formatted(label)),
                        "{\"decision\": \"REJECTED\", \"reason\": \"Etiketdəki əyar 583, məhsulda 585 yazılıb.\"}")
                        .with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(jdbc.queryForObject("SELECT checked_by FROM product_evidence_photos WHERE id = ?", Long.class,
                hallmark)).isEqualTo(adminId);
        assertThat(jdbc.queryForList("SELECT action FROM audit_logs WHERE target_type = 'CHECK' AND target_id = ?"
                + " ORDER BY id", String.class, String.valueOf(productId)))
                .containsExactly("EVIDENCE_PHOTO_VERIFIED", "EVIDENCE_PHOTO_REJECTED");
        assertThat(jdbc.queryForObject("SELECT actor_role FROM audit_logs WHERE action = 'EVIDENCE_PHOTO_VERIFIED'"
                + " AND target_id = ?", String.class, String.valueOf(productId))).isEqualTo("ADMIN");

        // The seller sees the decision; the public page waits for the product's approval.
        mvc.perform(get("/api/v1/merchant/products/" + productId).with(seller.token()))
                .andExpect(jsonPath("$.evidencePhotos[1].status").value("REJECTED"))
                .andExpect(jsonPath("$.evidencePhotos[1].checkNote").value(Matchers.startsWith("Etiketdəki")));
        String slug = jdbc.queryForObject("SELECT slug FROM products WHERE id = ?", String.class, productId);
        mvc.perform(get("/api/v1/products/" + slug)).andExpect(status().isNotFound());
        jdbc.update("UPDATE products SET status = 'APPROVED' WHERE id = ?", productId);
        mvc.perform(get("/api/v1/products/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evidencePhotos.length()").value(1))
                .andExpect(jsonPath("$.evidencePhotos[0].kind").value("HALLMARK"))
                .andExpect(jsonPath("$.evidencePhotos[0].checked").value(true))
                .andExpect(jsonPath("$.evidencePhotos[0].url").value(Matchers.endsWith(keyOf(hallmark))))
                .andExpect(jsonPath("$.images.length()").value(1));
    }
}
