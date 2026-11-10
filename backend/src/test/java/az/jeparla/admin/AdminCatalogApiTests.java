package az.jeparla.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Catalog settings of the admin (#40): categories and finenesses. ADMIN only, every write audited, nothing in use
 * deleted (409). Runs as the runtime database role, like every Spring test (#165).
 */
@AuthIntegrationTest
class AdminCatalogApiTests extends MerchantApiTestBase {

    private static final String CATEGORIES = "/api/v1/admin/categories";
    private static final String FINENESSES = "/api/v1/admin/finenesses";
    private static final String SYNONYMS = "/api/v1/admin/synonyms";

    private static String categoryJson(String slug, Long parentId, boolean active) {
        return """
                {"slug": "%s", "parentId": %s, "name": {"az": "Üzüklər", "en": "Rings", "ru": "Кольца"},
                 "sortOrder": 5, "active": %s}
                """.formatted(slug, parentId == null ? "null" : parentId, active);
    }

    private long createCategory(long adminId, String slug, Long parentId) throws Exception {
        MvcResult result = mvc.perform(json(post(CATEGORIES), categoryJson(slug, parentId, true))
                .with(AdminTestTokens.admin(adminId))).andExpect(status().isCreated()).andReturn();
        return id(result);
    }

    private long auditCount(String action, Object targetId) {
        Long count = jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = ? AND target_id = ?",
                Long.class, action, String.valueOf(targetId));
        return count == null ? 0 : count;
    }

    @Test
    void onlyAdminsManageTheCatalogSettings() throws Exception {
        long buyer = newBuyer();
        long merchant = newMerchant();
        for (String path : List.of(CATEGORIES, FINENESSES)) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(buyer(buyer))).andExpect(status().isForbidden());
            mvc.perform(get(path).with(merchant(merchant))).andExpect(status().isForbidden());
        }
        mvc.perform(json(post(CATEGORIES), categoryJson("x-" + TestData.next(), null, true)).with(buyer(buyer)))
                .andExpect(status().isForbidden());
        mvc.perform(delete(FINENESSES + "/1").with(merchant(merchant))).andExpect(status().isForbidden());
    }

    @Test
    void categoriesAreCreatedEditedAndDeletedWithAnAuditTrail() throws Exception {
        long adminId = newBuyer();
        String slug = "admin-cat-" + TestData.next();
        long root = createCategory(adminId, slug, null);
        assertThat(auditCount("CATEGORY_CREATED", root)).isEqualTo(1);

        // The same slug again: 409 on the field.
        mvc.perform(json(post(CATEGORIES), categoryJson(slug, null, true)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.slug_taken"))
                .andExpect(jsonPath("$.errors[0].field").value("slug"));
        // Invalid slug and blank names: 400.
        mvc.perform(json(post(CATEGORIES), """
                        {"slug": "Bad Slug", "name": {"az": "", "en": "x", "ru": "x"}}
                        """).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest());
        // Unknown parent.
        mvc.perform(json(post(CATEGORIES), categoryJson("orphan-" + TestData.next(), 999_999_999L, true))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("admin.parent_missing"));

        long child = createCategory(adminId, "admin-child-" + TestData.next(), root);
        // A category cannot move under itself or its subcategory.
        mvc.perform(json(put(CATEGORIES + "/" + root), categoryJson(slug, child, true))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.category_cycle"));
        mvc.perform(json(put(CATEGORIES + "/" + root), categoryJson(slug, root, true))
                        .with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.category_cycle"));

        // Deactivate: kept, out of the public tree.
        mvc.perform(json(put(CATEGORIES + "/" + child), categoryJson("admin-child-renamed-" + TestData.next(), root,
                        false)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.parentId").value(root))
                .andExpect(jsonPath("$.name.ru").value("Кольца"));
        assertThat(auditCount("CATEGORY_UPDATED", child)).isEqualTo(1);
        mvc.perform(get(CATEGORIES).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + root + ")].childCount").value(1))
                .andExpect(jsonPath("$[?(@.id == " + child + ")].active").value(false));

        // A parent with a child is in use; the child alone is not.
        mvc.perform(delete(CATEGORIES + "/" + root).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.category_in_use"));
        mvc.perform(delete(CATEGORIES + "/" + child).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isNoContent());
        assertThat(auditCount("CATEGORY_DELETED", child)).isEqualTo(1);
        mvc.perform(delete(CATEGORIES + "/" + child).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isNotFound());
    }

    @Test
    void aCategoryOrFinenessWithProductsIsNotDeleted() throws Exception {
        long adminId = newBuyer();
        Seller seller = seller(SellerKind.PRECIOUS, true);
        ensureQuote(Metal.GOLD);
        long category = category();
        long fineness = fineness(Metal.GOLD);
        createProduct(seller, goldProduct(category, fineness, "300.00"));

        mvc.perform(delete(CATEGORIES + "/" + category).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.category_in_use"));
        mvc.perform(delete(FINENESSES + "/" + fineness).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.fineness_in_use"));
        mvc.perform(get(CATEGORIES).with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$[?(@.id == " + category + ")].productCount").value(1));
        mvc.perform(get(FINENESSES).with(AdminTestTokens.admin(adminId)))
                .andExpect(jsonPath("$[?(@.id == " + fineness + ")].productCount").value(1))
                .andExpect(jsonPath("$[?(@.id == " + fineness + ")].inUse").value(true));

        // Label and order may change; metal and value of a used fineness may not.
        String value = jdbc.queryForObject("SELECT value FROM finenesses WHERE id = ?", String.class, fineness);
        mvc.perform(json(put(FINENESSES + "/" + fineness), """
                        {"metal": "GOLD", "value": %s, "label": "%s (relabelled)", "sortOrder": 3}
                        """.formatted(value, value)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value(value + " (relabelled)"));
        mvc.perform(json(put(FINENESSES + "/" + fineness), """
                        {"metal": "SILVER", "value": %s, "label": "x"}
                        """.formatted(value)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.fineness_in_use"));
    }

    @Test
    void synonymsAreManagedAndTheSearchUsesThemAtOnce() throws Exception {
        long adminId = newBuyer();
        tx.executeWithoutResult(status -> data.publicProduct(data.approvedStore(data.merchant()), data.category(),
                data.fineness(Metal.GOLD), "250.00"));
        // No trigram in common with any catalog word, so only the synonym can make it match.
        String word = "qxjv" + TestData.next();
        mvc.perform(get("/api/v1/search").param("q", word).param("type", "products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.products.totalElements").value(0));

        MvcResult created = mvc.perform(json(post(SYNONYMS), """
                        {"term": "%s", "synonym": "üzük"}
                        """.formatted(word)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.term").value(word))
                .andExpect(jsonPath("$.synonym").value("üzük"))
                .andReturn();
        long id = id(created);
        assertThat(auditCount("SYNONYM_CREATED", id)).isEqualTo(1);
        mvc.perform(get("/api/v1/search").param("q", word).param("type", "products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.products.totalElements").value(org.hamcrest.Matchers.greaterThan(0)));

        // The same pair in the other order, folded ("UZUK" = "üzük"), is a duplicate.
        mvc.perform(json(post(SYNONYMS), """
                        {"term": "UZUK", "synonym": "%s"}
                        """.formatted(word)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.synonym_exists"));
        // Two words, one letter, the same word folded: 400.
        for (String invalid : List.of("{\"term\": \"iki söz\", \"synonym\": \"üzük\"}",
                "{\"term\": \"a\", \"synonym\": \"üzük\"}", "{\"term\": \"Üzük\", \"synonym\": \"uzuk\"}")) {
            mvc.perform(json(post(SYNONYMS), invalid).with(AdminTestTokens.admin(adminId)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("admin.synonym_invalid"));
        }

        mvc.perform(get(SYNONYMS).param("q", word.toUpperCase()).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(id));

        mvc.perform(json(put(SYNONYMS + "/" + id), """
                        {"term": "%s", "synonym": "sırğa"}
                        """.formatted(word)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.synonym").value("sırğa"));
        assertThat(auditCount("SYNONYM_UPDATED", id)).isEqualTo(1);

        mvc.perform(delete(SYNONYMS + "/" + id).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isNoContent());
        assertThat(auditCount("SYNONYM_DELETED", id)).isEqualTo(1);
        mvc.perform(get("/api/v1/search").param("q", word).param("type", "products"))
                .andExpect(jsonPath("$.products.totalElements").value(0));
        mvc.perform(get(SYNONYMS).with(buyer(newBuyer()))).andExpect(status().isForbidden());
    }

    @Test
    void finenessesAreUniquePerMetalAndUnusedOnesAreDeleted() throws Exception {
        long adminId = newBuyer();
        // Numbers of this test only, mapped as TestData.fineness maps its own: no clash within the run.
        int value = 1 + TestData.next() % 999;
        int otherValue = 1 + TestData.next() % 999;
        MvcResult created = mvc.perform(json(post(FINENESSES), """
                        {"metal": "PALLADIUM", "value": %d, "label": "Pd %d"}
                        """.formatted(value, value)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.productCount").value(0))
                .andExpect(jsonPath("$.inUse").value(false))
                .andReturn();
        long id = id(created);
        assertThat(auditCount("FINENESS_CREATED", id)).isEqualTo(1);
        mvc.perform(json(post(FINENESSES), """
                        {"metal": "PALLADIUM", "value": %d, "label": "again"}
                        """.formatted(value)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("admin.fineness_exists"));
        mvc.perform(json(post(FINENESSES), """
                        {"metal": "PALLADIUM", "value": 1001, "label": "x"}
                        """).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isBadRequest());
        // Unused: metal and value may still change.
        mvc.perform(json(put(FINENESSES + "/" + id), """
                        {"metal": "PALLADIUM", "value": %d, "label": "Pd", "active": false}
                        """.formatted(otherValue)).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(otherValue))
                .andExpect(jsonPath("$.active").value(false));
        mvc.perform(delete(FINENESSES + "/" + id).with(AdminTestTokens.admin(adminId)))
                .andExpect(status().isNoContent());
        assertThat(auditCount("FINENESS_DELETED", id)).isEqualTo(1);
        assertThat(JsonPath.<List<Object>>read(body(mvc.perform(get(FINENESSES).with(AdminTestTokens.admin(adminId)))
                .andReturn()), "$[?(@.id == " + id + ")]")).isEmpty();
    }
}
