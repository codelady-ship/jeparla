package az.jeparla.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * Occasion collections (#115): the admin manages the list (ADMIN only, audited), a seller tags only their own
 * products with shown collections, and visitors see shown collections with the count of listed tagged products.
 */
@AuthIntegrationTest
class CollectionApiTests extends MerchantApiTestBase {

    private static final String ADMIN = "/api/v1/admin/collections";
    private static final String PUBLIC = "/api/v1/collections";
    private static final String PRODUCTS = "/api/v1/merchant/products";

    private static String collectionJson(String slug, String az, Boolean active) {
        return """
                {"slug": "%s", "name": {"az": "%s", "en": "Engagement", "ru": "Помолвка"}, "active": %s}
                """.formatted(slug, az, active == null ? "null" : active);
    }

    private long createCollection(long adminId, String slug) throws Exception {
        return id(mvc.perform(json(post(ADMIN), collectionJson(slug, "Nişan " + slug, true))
                .with(AdminTestTokens.admin(adminId))).andExpect(status().isCreated()).andReturn());
    }

    private long auditCount(String action, Object targetId) {
        Long count = jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = ? AND target_id = ?",
                Long.class, action, String.valueOf(targetId));
        return count == null ? 0 : count;
    }

    /** A gold product of the seller tagged with the given collections (JSON array body, e.g. "[1, 2]"). */
    private String taggedProduct(long categoryId, long finenessId, String collectionIds) {
        String product = goldProduct(categoryId, finenessId, "450.00").strip();
        return product.substring(0, product.length() - 1) + ", \"collectionIds\": " + collectionIds + "}";
    }

    private List<Long> tagsOf(long productId) {
        return jdbc.queryForList("SELECT collection_id FROM collection_products WHERE product_id = ? ORDER BY 1",
                Long.class, productId);
    }

    @Test
    void theFirstSixCollectionsAreReferenceData() throws Exception {
        String body = body(mvc.perform(get(PUBLIC)).andExpect(status().isOk()).andReturn());
        List<String> slugs = JsonPath.read(body, "$[*].slug");
        assertThat(slugs).containsSubsequence("nisan", "toy", "hediyye", "gundelik", "kisi-ucun", "usaq-ucun");
        assertThat(JsonPath.<List<String>>read(body, "$[?(@.slug == 'kisi-ucun')].name.ru")).containsExactly("Для него");
    }

    @Test
    void onlyAdminsManageCollections() throws Exception {
        long buyer = newBuyer();
        long merchant = newMerchant();
        mvc.perform(get(ADMIN)).andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN).with(buyer(buyer))).andExpect(status().isForbidden());
        mvc.perform(get(ADMIN).with(merchant(merchant))).andExpect(status().isForbidden());
        String body = collectionJson("c-" + TestData.next(), "Ad", true);
        mvc.perform(json(post(ADMIN), body).with(merchant(merchant))).andExpect(status().isForbidden());
        mvc.perform(json(put(ADMIN + "/1"), body).with(merchant(merchant))).andExpect(status().isForbidden());
        mvc.perform(json(put(ADMIN + "/order"), "{\"ids\": [1]}").with(buyer(buyer)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCreatesRenamesHidesAndReordersWithAnAuditTrail() throws Exception {
        long adminId = newBuyer();
        String slug = "occasion-" + TestData.next();
        long id = createCollection(adminId, slug);
        assertThat(auditCount("COLLECTION_CREATED", id)).isEqualTo(1);

        mvc.perform(json(post(ADMIN), collectionJson(slug, "Again", true)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.slug_taken"));
        mvc.perform(json(post(ADMIN), "{\"slug\": \"Bad Slug\", \"name\": {\"az\": \"\", \"en\": \"x\", \"ru\": \"x\"}}")
                .with(AdminTestTokens.admin(adminId))).andExpect(status().isBadRequest());

        // Rename and hide: the public list leaves it out, the admin list keeps it.
        mvc.perform(json(put(ADMIN + "/" + id), collectionJson(slug, "Ad günü", false))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name.az").value("Ad günü"))
                .andExpect(jsonPath("$.active").value(false));
        assertThat(auditCount("COLLECTION_UPDATED", id)).isEqualTo(1);
        List<String> shown = JsonPath.read(body(mvc.perform(get(PUBLIC)).andReturn()), "$[*].slug");
        assertThat(shown).doesNotContain(slug);
        List<String> all = JsonPath.read(body(mvc.perform(get(ADMIN).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk()).andReturn()), "$[*].slug");
        assertThat(all).contains(slug);

        // Reorder: every collection exactly once, or 400.
        List<Number> raw = JsonPath.read(body(mvc.perform(get(ADMIN).with(AdminTestTokens.admin(adminId)))
                .andReturn()), "$[*].id");
        List<Long> before = raw.stream().map(Number::longValue).toList();
        List<Long> reversed = new ArrayList<>(before);
        Collections.reverse(reversed);
        mvc.perform(json(put(ADMIN + "/order"), order(reversed.subList(1, reversed.size())))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.collection_order"));
        String reorderedBody = body(mvc.perform(json(put(ADMIN + "/order"), order(reversed))
                .with(AdminTestTokens.admin(adminId))).andExpect(status().isOk()).andReturn());
        List<Number> after = JsonPath.read(reorderedBody, "$[*].id");
        assertThat(after.stream().map(Number::longValue).toList()).isEqualTo(reversed);
        // Back to the original order, for the other tests of this context.
        mvc.perform(json(put(ADMIN + "/order"), order(before)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk());
    }

    @Test
    void aSellerTagsOnlyOwnProductsWithShownCollections() throws Exception {
        long adminId = newBuyer();
        long shown = createCollection(adminId, "tag-" + TestData.next());
        long hidden = createCollection(adminId, "tag-" + TestData.next());
        long otherHidden = createCollection(adminId, "tag-" + TestData.next());
        Seller owner = seller(SellerKind.PRECIOUS, true);
        Seller other = seller(SellerKind.PRECIOUS, true);
        long categoryId = category();
        long finenessId = fineness(Metal.GOLD);

        long productId = createProduct(owner, taggedProduct(categoryId, finenessId, "[" + shown + ", " + hidden + "]"));
        assertThat(tagsOf(productId)).containsExactly(shown, hidden);
        mvc.perform(get(PRODUCTS + "/" + productId).with(owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionIds.length()").value(2));

        // Hide two: the seller can no longer choose a hidden one, but the product keeps the tag it has.
        for (long id : List.of(hidden, otherHidden)) {
            mvc.perform(json(put(ADMIN + "/" + id), collectionJson("tag-h-" + TestData.next(), "Gizli", false))
                    .with(AdminTestTokens.admin(adminId))).andExpect(status().isOk());
        }
        mvc.perform(json(put(PRODUCTS + "/" + productId),
                        taggedProduct(categoryId, finenessId, "[" + otherHidden + "]")).with(owner.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.collection_unknown"))
                .andExpect(jsonPath("$.errors[0].field").value("collectionIds"));
        mvc.perform(json(put(PRODUCTS + "/" + productId), taggedProduct(categoryId, finenessId, "[999999999]"))
                        .with(owner.token()))
                .andExpect(status().isBadRequest());
        // Sending back a hidden tag the product has is fine; leaving it out keeps it too.
        mvc.perform(json(put(PRODUCTS + "/" + productId), taggedProduct(categoryId, finenessId, "[" + hidden + "]"))
                .with(owner.token())).andExpect(status().isOk());
        assertThat(tagsOf(productId)).containsExactly(hidden);
        mvc.perform(json(put(PRODUCTS + "/" + productId), taggedProduct(categoryId, finenessId, "[" + shown + "]"))
                .with(owner.token())).andExpect(status().isOk());
        assertThat(tagsOf(productId)).containsExactly(shown, hidden);
        mvc.perform(json(put(PRODUCTS + "/" + productId), taggedProduct(categoryId, finenessId, "[]"))
                .with(owner.token())).andExpect(status().isOk());
        assertThat(tagsOf(productId)).containsExactly(hidden);
        // Without collectionIds the tags stay as they are.
        mvc.perform(json(put(PRODUCTS + "/" + productId), goldProduct(categoryId, finenessId, "450.00"))
                .with(owner.token())).andExpect(status().isOk());
        assertThat(tagsOf(productId)).containsExactly(hidden);

        // Another seller cannot tag (or read) this product.
        mvc.perform(json(put(PRODUCTS + "/" + productId), taggedProduct(categoryId, finenessId, "[" + shown + "]"))
                        .with(other.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("auth.forbidden"));
        assertThat(tagsOf(productId)).containsExactly(hidden);
        // Tagging changes no moderation state: the product is still a draft, not sent to review.
        assertThat(jdbc.queryForObject("SELECT status FROM products WHERE id = ?", String.class, productId))
                .isEqualTo("DRAFT");
    }

    @Test
    void visitorsSeeListedTaggedProductsOnly() throws Exception {
        long adminId = newBuyer();
        String slug = "listed-" + TestData.next();
        long collection = createCollection(adminId, slug);
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long categoryId = category();
        long finenessId = fineness(Metal.GOLD);
        long listed = createProduct(seller, taggedProduct(categoryId, finenessId, "[" + collection + "]"));
        long draft = createProduct(seller, taggedProduct(categoryId, finenessId, "[" + collection + "]"));
        jdbc.update("UPDATE products SET status = 'APPROVED', submitted_at = now(), published_at = now() WHERE id = ?",
                listed);

        assertThat(publicCount(slug)).isEqualTo(1);
        String page = body(mvc.perform(get("/api/v1/products").param("collection", slug))
                .andExpect(status().isOk()).andReturn());
        List<Number> ids = JsonPath.read(page, "$.content[*].id");
        assertThat(ids.stream().map(Number::longValue).toList()).containsExactly(listed).doesNotContain(draft);
        // The budget filter combines with the collection (450 AZN).
        mvc.perform(get("/api/v1/products").param("collection", slug).param("maxPrice", "200"))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/products").param("collection", slug).param("maxPrice", "500"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/products").param("collection", "no-such-collection"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        // Hidden: no page, no products.
        mvc.perform(json(put(ADMIN + "/" + collection), collectionJson(slug, "Gizli", false))
                .with(AdminTestTokens.admin(adminId))).andExpect(status().isOk());
        assertThat(publicCount(slug)).isNull();
        mvc.perform(get("/api/v1/products").param("collection", slug))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    /** productCount of the collection in the public list, or null when it is not listed. */
    private Integer publicCount(String slug) throws Exception {
        String body = body(mvc.perform(get(PUBLIC)).andExpect(status().isOk()).andReturn());
        List<Integer> counts = JsonPath.read(body, "$[?(@.slug == '" + slug + "')].productCount");
        return counts.isEmpty() ? null : counts.get(0);
    }

    private static String order(List<Long> ids) {
        return "{\"ids\": [" + ids.stream().map(String::valueOf).collect(Collectors.joining(", ")) + "]}";
    }
}
