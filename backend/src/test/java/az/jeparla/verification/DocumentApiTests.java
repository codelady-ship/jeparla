package az.jeparla.verification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Verification documents (#40, #138): only precious-metal sellers upload, every upload is confirmed with the
 * declaration (kept as evidence), files stay in the private bucket, admins review them through short-lived
 * audited links, and a refusal notifies the seller in their language (in-app and email outbox).
 */
@AuthIntegrationTest
class DocumentApiTests extends MerchantApiTestBase {

    private static final byte[] PDF = "%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n"
            .getBytes(StandardCharsets.US_ASCII);
    private static final String UPLOADS = "/api/v1/merchant/documents/uploads";
    private static final String DOCUMENTS = "/api/v1/merchant/documents";

    private static JwtRequestPostProcessor admin(long userId) {
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private long newAdmin() {
        return newBuyer();
    }

    private static String taxIdUpload(int sizeBytes) {
        return """
                {"checkKind": "DOCUMENTS", "kind": "TAX_ID", "fileName": "voen.pdf",
                 "contentType": "application/pdf", "sizeBytes": %d}
                """.formatted(sizeBytes);
    }

    private static String confirmJson(String key, Boolean accepted, String version) {
        return """
                {"key": "%s", "declarationAccepted": %s, "declarationVersion": %s}
                """.formatted(key, accepted, version == null ? "null" : "\"" + version + "\"");
    }

    private String presign(Seller seller, String json) throws Exception {
        MvcResult result = mvc.perform(json(post(UPLOADS), json).with(seller.token()))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(body(result), "$.key");
    }

    /** Presign, the browser's PUT and the confirmation with the declaration. Returns the document id. */
    private String uploadDocument(Seller seller, String json) throws Exception {
        String key = presign(seller, json);
        storage.put(key, PDF, "application/pdf");
        MvcResult result = mvc.perform(json(post(DOCUMENTS), confirmJson(key, true, DeclarationText.VERSION))
                .with(seller.token())).andExpect(status().isCreated()).andReturn();
        return JsonPath.read(body(result), "$.id");
    }

    private String documentsStatus(Seller seller) {
        return jdbc.queryForObject("SELECT documents_status FROM stores WHERE id = ?", String.class, seller.storeId());
    }

    private void decide(long adminId, String documentId, String json) throws Exception {
        mvc.perform(json(post("/api/v1/admin/documents/" + documentId + "/decision"), json).with(admin(adminId)))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ roles

    @Test
    void onlyMerchantsUploadAndOnlyAdminsReview() throws Exception {
        long buyer = newBuyer();
        long adminId = newAdmin();
        Seller seller = seller(SellerKind.PRECIOUS, true);
        mvc.perform(get(DOCUMENTS)).andExpect(status().isUnauthorized());
        mvc.perform(json(post(UPLOADS), taxIdUpload(100))).andExpect(status().isUnauthorized());
        mvc.perform(get(DOCUMENTS).with(buyer(buyer))).andExpect(status().isForbidden());
        // ADMIN is not MERCHANT: an admin never uploads as a seller.
        mvc.perform(get(DOCUMENTS).with(admin(adminId))).andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/admin/documents")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/documents").with(seller.token())).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/documents").with(buyer(buyer))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/documents").with(admin(adminId))).andExpect(status().isOk());

        mvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("auth.unauthenticated"));
        mvc.perform(get("/api/v1/notifications").with(buyer(buyer))).andExpect(status().isOk());
    }

    @Test
    void bijouterieSellersAndProductsNeverUploadDocuments() throws Exception {
        Seller fashion = seller(SellerKind.FASHION, true);
        mvc.perform(json(post(UPLOADS), taxIdUpload(100)).with(fashion.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification.not_precious"));
        mvc.perform(json(post(DOCUMENTS), confirmJson("documents/1/x.pdf", true, DeclarationText.VERSION))
                        .with(fashion.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification.not_precious"));
        assertThat(documentsStatus(fashion)).isEqualTo("NONE");

        // A MIXED store uploads store documents, but no certificate for a bijouterie product.
        Seller mixed = seller(SellerKind.MIXED, true);
        long beads = createProduct(mixed, beadsProduct(category(), "Muncuqlu bilərzik"));
        mvc.perform(json(post(UPLOADS), """
                        {"checkKind": "EXPERTISE", "kind": "ASSAY_CERTIFICATE", "productId": %d,
                         "fileName": "cert.pdf", "contentType": "application/pdf", "sizeBytes": 100}
                        """.formatted(beads)).with(mixed.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification.not_precious"));
        assertThat(jdbc.queryForObject("SELECT expertise_status FROM products WHERE id = ?", String.class, beads))
                .isEqualTo("NONE");
        mvc.perform(json(post(UPLOADS), taxIdUpload(100)).with(mixed.token())).andExpect(status().isOk());
    }

    @Test
    void anotherMerchantsStoreAndProductsAreOutOfReach() throws Exception {
        Seller owner = seller(SellerKind.PRECIOUS, true);
        Seller other = seller(SellerKind.PRECIOUS, true);
        String key = presign(owner, taxIdUpload(PDF.length));
        storage.put(key, PDF, "application/pdf");
        // The other seller cannot confirm the owner's upload: it was not issued to their store.
        mvc.perform(json(post(DOCUMENTS), confirmJson(key, true, DeclarationText.VERSION)).with(other.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification.document_missing"));
        mvc.perform(json(post(DOCUMENTS), confirmJson(key, true, DeclarationText.VERSION)).with(owner.token()))
                .andExpect(status().isCreated());
        mvc.perform(get(DOCUMENTS).with(other.token())).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(DOCUMENTS).with(owner.token())).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("PENDING"))
                // The seller never gets a storage key or a URL back.
                .andExpect(jsonPath("$[0].storageKey").doesNotExist())
                .andExpect(jsonPath("$[0].url").doesNotExist());

        ensureQuote(Metal.GOLD);
        long product = createProduct(owner, goldProduct(category(), fineness(Metal.GOLD), "450.00"));
        mvc.perform(json(post(UPLOADS), """
                        {"checkKind": "EXPERTISE", "kind": "LAB_REPORT", "productId": %d,
                         "fileName": "lab.pdf", "contentType": "application/pdf", "sizeBytes": 100}
                        """.formatted(product)).with(other.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
        mvc.perform(json(post(UPLOADS), """
                        {"checkKind": "EXPERTISE", "kind": "LAB_REPORT", "productId": 999999999,
                         "fileName": "lab.pdf", "contentType": "application/pdf", "sizeBytes": 100}
                        """).with(other.token()))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ declaration and upload

    @Test
    void theDeclarationIsRequiredAndKeptAsEvidence() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        mvc.perform(get(DOCUMENTS + "/declaration").header("Accept-Language", "en").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(DeclarationText.VERSION))
                .andExpect(jsonPath("$.language").value("en"))
                .andExpect(jsonPath("$.draft").value(true))
                .andExpect(jsonPath("$.text").value(Matchers.containsString("including the Criminal Code")));
        mvc.perform(get(DOCUMENTS + "/declaration").with(seller.token()))
                .andExpect(jsonPath("$.language").value("az"))
                .andExpect(jsonPath("$.text").value(Matchers.containsString("Cinayət Məcəlləsinə")));

        String key = presign(seller, taxIdUpload(PDF.length));
        assertThat(key).matches("documents/" + seller.storeId() + "/[0-9a-f-]{36}\\.pdf");
        storage.put(key, PDF, "application/pdf");
        for (String refused : List.of(confirmJson(key, null, DeclarationText.VERSION),
                confirmJson(key, false, DeclarationText.VERSION))) {
            mvc.perform(json(post(DOCUMENTS), refused).with(seller.token()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("verification.declaration_required"))
                    .andExpect(jsonPath("$.errors[0].field").value("declarationAccepted"));
        }
        mvc.perform(json(post(DOCUMENTS), confirmJson(key, true, "precious-2020-01-01")).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("verification.declaration_outdated"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM verification_documents WHERE store_id = ?", Integer.class,
                seller.storeId())).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM seller_declarations WHERE store_id = ?", Integer.class,
                seller.storeId())).isZero();
        assertThat(storage.isPrivate(key)).isFalse();

        String body = body(mvc.perform(json(post(DOCUMENTS),
                        "{\"key\": \"%s\", \"declarationAccepted\": true, \"declarationVersion\": \"%s\", \"declarationLanguage\": \"ru\"}"
                                .formatted(key, DeclarationText.VERSION)).with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.kind").value("TAX_ID"))
                .andReturn());
        String id = JsonPath.read(body, "$.id");

        Map<String, Object> declaration = jdbc.queryForMap("""
                SELECT d.user_id, d.text_version, d.language, d.text, d.confirmed_at, d.store_id
                FROM seller_declarations d JOIN verification_documents v ON v.declaration_id = d.id WHERE v.id = ?::uuid
                """, id);
        assertThat(((Number) declaration.get("user_id")).longValue()).isEqualTo(seller.userId());
        assertThat(declaration.get("text_version")).isEqualTo(DeclarationText.VERSION);
        assertThat(declaration.get("language")).isEqualTo("ru");
        assertThat((String) declaration.get("text")).contains("включая Уголовный кодекс");
        assertThat(declaration.get("confirmed_at")).isNotNull();
        assertThat(jdbc.queryForObject("SELECT sha256 FROM verification_documents WHERE id = ?::uuid", String.class, id))
                .matches("[0-9a-f]{64}");
        assertThat(documentsStatus(seller)).isEqualTo("PENDING");
        assertThat(jdbc.queryForList("SELECT action FROM audit_logs WHERE (target_type = 'STORE' AND target_id = ?)"
                        + " OR (target_type = 'DOCUMENT' AND target_id = ?)", String.class,
                String.valueOf(seller.storeId()), id))
                .contains("DECLARATION_CONFIRMED", "DOCUMENT_UPLOADED");

        // Private, never public: moved from staging to the private bucket, nothing in the public one.
        assertThat(storage.isPrivate(key)).isTrue();
        assertThat(storage.isStaged(key)).isFalse();
        assertThat(storage.contains(key)).isFalse();

        // The declaration is evidence: the database refuses to change or delete it.
        assertThatThrownBy(() -> jdbc.update("UPDATE seller_declarations SET text = 'x' WHERE store_id = ?",
                seller.storeId())).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM seller_declarations WHERE store_id = ?", seller.storeId()))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void aFileThatIsNotTheDocumentItClaimsIsRefused() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        mvc.perform(json(post(UPLOADS), """
                        {"checkKind": "DOCUMENTS", "kind": "TAX_ID", "fileName": "a.svg",
                         "contentType": "image/svg+xml", "sizeBytes": 100}
                        """).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification.document_type"));
        mvc.perform(json(post(UPLOADS), taxIdUpload(10 * 1024 * 1024 + 1)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification.document_size"));
        mvc.perform(json(post(UPLOADS), """
                        {"checkKind": "DOCUMENTS", "kind": "ASSAY_CERTIFICATE", "fileName": "a.pdf",
                         "contentType": "application/pdf", "sizeBytes": 100}
                        """).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification.document_kind"));

        String key = presign(seller, taxIdUpload(100));
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        storage.put(key, html, "application/pdf");
        mvc.perform(json(post(DOCUMENTS), confirmJson(key, true, DeclarationText.VERSION)).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification.document_type"));
        assertThat(storage.isStaged(key)).isFalse();
        assertThat(storage.isPrivate(key)).isFalse();
        assertThat(documentsStatus(seller)).isEqualTo("NONE");
    }

    // ------------------------------------------------------------------ review

    @Test
    void aRejectionNotifiesTheSellerInTheirLanguage() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        jdbc.update("UPDATE users SET preferred_locale = 'ru' WHERE id = ?", seller.userId());
        long adminId = newAdmin();
        String id = uploadDocument(seller, taxIdUpload(PDF.length));

        mvc.perform(json(post("/api/v1/admin/documents/" + id + "/decision"), "{\"decision\": \"REJECT\"}")
                        .with(admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification.reason_required"));
        mvc.perform(json(post("/api/v1/admin/documents/" + id + "/decision"),
                        "{\"decision\": \"REJECT\", \"reason\": \"EXPIRED\", \"note\": \"VÖEN çıxarışı 2024-cü ildəndir\"}")
                        .with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectReason").value("EXPIRED"));
        assertThat(documentsStatus(seller)).isEqualTo("REJECTED");

        Map<String, Object> notification = jdbc.queryForMap(
                "SELECT id, kind, language, title, body, link FROM notifications WHERE user_id = ?", seller.userId());
        assertThat(notification.get("kind")).isEqualTo("DOCUMENT_REJECTED");
        assertThat(notification.get("language")).isEqualTo("ru");
        assertThat(notification.get("title")).isEqualTo("Документ не принят");
        assertThat((String) notification.get("body"))
                .startsWith("К сожалению, мы не смогли принять ваш документ.")
                .contains("Причина: Срок действия документа истёк.")
                .contains("VÖEN çıxarışı 2024-cü ildəndir")
                .contains("voen.pdf");
        assertThat(notification.get("link")).isEqualTo("/merchant/documents");
        Map<String, Object> email = jdbc.queryForMap(
                "SELECT to_address, language, subject, status FROM email_outbox WHERE notification_id = ?",
                notification.get("id"));
        assertThat((String) email.get("to_address")).endsWith("@jeparla.test");
        assertThat(email.get("language")).isEqualTo("ru");
        assertThat(email.get("subject")).isEqualTo("Документ не принят");
        // No provider in tests (#131): the email waits, it is never claimed as sent.
        assertThat(email.get("status")).isEqualTo("PENDING");

        long notificationId = ((Number) notification.get("id")).longValue();
        mvc.perform(get("/api/v1/notifications/unread-count").with(seller.token()))
                .andExpect(jsonPath("$.unread").value(1));
        mvc.perform(get("/api/v1/notifications").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].kind").value("DOCUMENT_REJECTED"))
                .andExpect(jsonPath("$.content[0].title").value("Документ не принят"))
                .andExpect(jsonPath("$.content[0].readAt").doesNotExist());
        // Someone else's notification is 404.
        mvc.perform(post("/api/v1/notifications/" + notificationId + "/read").with(buyer(newBuyer())))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/notifications/" + notificationId + "/read").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").exists());
        mvc.perform(get("/api/v1/notifications/unread-count").with(seller.token()))
                .andExpect(jsonPath("$.unread").value(0));

        // Decided once; the decision is audited with its reason.
        mvc.perform(json(post("/api/v1/admin/documents/" + id + "/decision"), "{\"decision\": \"APPROVE\"}")
                        .with(admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("verification.already_reviewed"));
        assertThat(jdbc.queryForObject(
                "SELECT reason FROM audit_logs WHERE action = 'DOCUMENT_REJECTED' AND target_id = ?", String.class, id))
                .startsWith("EXPIRED");
    }

    @Test
    void onlyAnApprovedDocumentMakesTheCheckVerified() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long adminId = newAdmin();
        String slug = jdbc.queryForObject("SELECT slug FROM stores WHERE id = ?", String.class, seller.storeId());
        String first = uploadDocument(seller, taxIdUpload(PDF.length));
        mvc.perform(get("/api/v1/stores/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.verification.documents").value("PENDING"));

        decide(adminId, first, "{\"decision\": \"REQUEST_CHANGES\", \"reason\": \"UNREADABLE\"}");
        assertThat(documentsStatus(seller)).isEqualTo("REJECTED");
        assertThat(jdbc.queryForObject("SELECT kind FROM notifications WHERE user_id = ?", String.class,
                seller.userId())).isEqualTo("DOCUMENT_CHANGES_REQUESTED");

        byte[] second = (new String(PDF, StandardCharsets.US_ASCII) + "% second\n").getBytes(StandardCharsets.US_ASCII);
        String key = presign(seller, taxIdUpload(second.length));
        storage.put(key, second, "application/pdf");
        String id = JsonPath.read(body(mvc.perform(json(post(DOCUMENTS), confirmJson(key, true, DeclarationText.VERSION))
                .with(seller.token())).andExpect(status().isCreated()).andReturn()), "$.id");
        assertThat(documentsStatus(seller)).isEqualTo("PENDING");
        decide(adminId, id, "{\"decision\": \"APPROVE\"}");
        assertThat(documentsStatus(seller)).isEqualTo("VERIFIED");

        String publicStore = body(mvc.perform(get("/api/v1/stores/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.verification.documents").value("VERIFIED")).andReturn());
        // The public API shows the resulting status only, never a document, its key or its hash.
        assertThat(publicStore).doesNotContain("documents/").doesNotContain("voen.pdf").doesNotContain("sha256");
    }

    @Test
    void expertiseOfAPreciousProductFollowsItsCertificate() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long adminId = newAdmin();
        ensureQuote(Metal.GOLD);
        long product = createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "450.00"));
        String id = uploadDocument(seller, """
                {"checkKind": "EXPERTISE", "kind": "ASSAY_CERTIFICATE", "productId": %d, "fileName": "eyar.pdf",
                 "contentType": "application/pdf", "sizeBytes": %d}
                """.formatted(product, PDF.length));
        assertThat(jdbc.queryForObject("SELECT expertise_status FROM products WHERE id = ?", String.class, product))
                .isEqualTo("PENDING");
        // The store's documents check is not touched by a product certificate.
        assertThat(documentsStatus(seller)).isEqualTo("NONE");
        decide(adminId, id, "{\"decision\": \"APPROVE\"}");
        assertThat(jdbc.queryForObject("SELECT expertise_status FROM products WHERE id = ?", String.class, product))
                .isEqualTo("VERIFIED");
    }

    @Test
    void anAdminOpensADocumentThroughAShortLivedAuditedLink() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long adminId = newAdmin();
        String id = uploadDocument(seller, taxIdUpload(PDF.length));
        mvc.perform(post("/api/v1/admin/documents/" + id + "/view")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/admin/documents/" + id + "/view").with(seller.token()))
                .andExpect(status().isForbidden());
        MvcResult result = mvc.perform(post("/api/v1/admin/documents/" + id + "/view").with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(Matchers.containsString("X-Amz-Expires=300")))
                .andReturn();
        Instant expiresAt = Instant.parse(JsonPath.read(body(result), "$.expiresAt"));
        assertThat(expiresAt).isBefore(Instant.now().plusSeconds(301));
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM audit_logs WHERE action = 'DOCUMENT_VIEWED' AND target_id = ? AND actor_id = ?",
                Integer.class, id, adminId)).isEqualTo(1);

        mvc.perform(get("/api/v1/admin/documents/" + id).with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.declaration.version").value(DeclarationText.VERSION))
                .andExpect(jsonPath("$.sha256").value(Matchers.matchesPattern("[0-9a-f]{64}")))
                .andExpect(jsonPath("$.storageKey").doesNotExist());
        mvc.perform(get("/api/v1/admin/documents").with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id").value(Matchers.hasItem(id)));
    }

    // ------------------------------------------------------------------ moderation

    @Test
    void aPreciousProductIsPublishedOnlyAfterTheDeclaration() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long adminId = newAdmin();
        ensureQuote(Metal.GOLD);
        long product = createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "450.00"));
        attachPng(seller, product);
        mvc.perform(json(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                        "/api/v1/merchant/products/" + product + "/status"), "{\"status\": \"IN_REVIEW\"}")
                        .with(seller.token()))
                .andExpect(status().isOk());
        String decision = "/api/v1/admin/products/" + product + "/decision";
        mvc.perform(json(post(decision), "{\"decision\": \"APPROVE\"}").with(seller.token()))
                .andExpect(status().isForbidden());
        mvc.perform(json(post(decision), "{\"decision\": \"APPROVE\"}").with(admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.declaration_missing"));
        mvc.perform(json(post(decision), "{\"decision\": \"RETURN\", \"reason\": \"qısa\"}").with(admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"));

        uploadDocument(seller, taxIdUpload(PDF.length));
        mvc.perform(json(post(decision), "{\"decision\": \"APPROVE\"}").with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        assertThat(jdbc.queryForList("SELECT kind FROM notifications WHERE user_id = ?", String.class,
                seller.userId())).contains("PRODUCT_APPROVED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'PRODUCT_APPROVED'"
                + " AND target_id = ?", Integer.class, String.valueOf(product))).isEqualTo(1);
    }

    @Test
    void storeDecisionsNeedAReasonAndNotifyTheSeller() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long adminId = newAdmin();
        String status = "/api/v1/admin/stores/" + seller.storeId() + "/status";
        mvc.perform(json(post(status), "{\"status\": \"REJECTED\"}").with(admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.reason_required"));
        mvc.perform(json(post(status), "{\"status\": \"REJECTED\", \"reason\": \"VÖEN reyestrdə tapılmadı\"}")
                        .with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(jdbc.queryForObject("SELECT body FROM notifications WHERE user_id = ? AND kind = 'STORE_REJECTED'",
                String.class, seller.userId())).contains("VÖEN reyestrdə tapılmadı");
        mvc.perform(json(post("/api/v1/admin/stores/" + seller.storeId() + "/seller-check"),
                        "{\"decision\": \"VERIFIED\"}").with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sellerStatus").value("VERIFIED"))
                // A bijouterie store never gets a documents check (#128).
                .andExpect(jsonPath("$.documentsStatus").value("NONE"));
        mvc.perform(get("/api/v1/admin/audit").param("targetType", "STORE")
                        .param("targetId", String.valueOf(seller.storeId())).with(admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].action").value(Matchers.hasItem("STORE_REJECTED")));
    }
}
