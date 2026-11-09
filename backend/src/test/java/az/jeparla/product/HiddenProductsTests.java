package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.support.CatalogApiTest;
import az.jeparla.support.TestData;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The public catalog shows only listed products: APPROVED, not deleted, of an APPROVED store, in a
 * visible category (it and its ancestors active) and with a live variant. Anything else is invisible
 * in every endpoint: lists, product page, favorites by id, compare, counts, reports and clicks.
 */
@CatalogApiTest
class HiddenProductsTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Instant NOW = Instant.parse("2026-11-05T08:00:00Z");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private TestData data;

    @Autowired
    private EntityManager em;

    /** A named way to hide a product that has its own store and category. */
    private record Case(String name, Function<Fixture, Product> setUp) {
        @Override
        public String toString() {
            return name;
        }
    }

    /** Creates test rows with {@link TestData}. */
    private final class Fixture {

        Store store = data.approvedStore(data.merchant());
        Category category = data.category();

        Product listed() {
            return data.publicProduct(store, category, data.fineness(Metal.GOLD), "250.00");
        }

        Product draft() {
            return data.product(store, category, data.fineness(Metal.GOLD), "250.00");
        }

        EntityManager em() {
            return em;
        }
    }

    static Stream<Arguments> hiddenProducts() {
        return Stream.of(
                Arguments.of(new Case("draft", Fixture::draft)),
                Arguments.of(new Case("in review", f -> {
                    Product p = f.draft();
                    p.submitForReview(NOW);
                    return p;
                })),
                Arguments.of(new Case("returned to the seller", f -> {
                    Product p = f.draft();
                    p.returnToSeller("photo");
                    return p;
                })),
                Arguments.of(new Case("deactivated", f -> {
                    Product p = f.listed();
                    p.deactivate("sold out");
                    return p;
                })),
                Arguments.of(new Case("deleted", f -> {
                    Product p = f.listed();
                    p.softDelete(NOW);
                    return p;
                })),
                Arguments.of(new Case("store pending", f -> {
                    f.store.setStatus(StoreStatus.PENDING);
                    return f.listed();
                })),
                Arguments.of(new Case("store blocked", f -> {
                    f.store.setStatus(StoreStatus.BLOCKED);
                    return f.listed();
                })),
                Arguments.of(new Case("category inactive", f -> {
                    f.category.setActive(false);
                    return f.listed();
                })),
                Arguments.of(new Case("parent category inactive", f -> {
                    Category child = new Category(f.category, "child-" + TestData.next(),
                            LocalizedText.of("Alt", "Sub", "Под"), 1);
                    f.em().persist(child);
                    f.category.setActive(false);
                    f.category = child;
                    return f.listed();
                })),
                Arguments.of(new Case("no live variant", f -> {
                    Product p = f.listed();
                    f.em().flush();
                    p.removeVariant(p.getVariants().getFirst(), NOW);
                    return p;
                })));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("hiddenProducts")
    void hiddenProductsAreInvisibleEverywhere(Case hidden) throws Exception {
        Fixture fixture = new Fixture();
        Product product = hidden.setUp().apply(fixture);
        em.flush();
        em.clear();
        long id = product.getId();
        long variantId = em.createQuery("select v.id from ProductVariant v where v.product.id = :id", Long.class)
                .setParameter("id", id).getSingleResult();

        mvc.perform(get("/api/v1/products/" + product.getSlug())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/products?ids=" + id)).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/v1/variants?ids=" + variantId)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/v1/products?size=96&store=" + fixture.store.getSlug()))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/products?size=96&category=" + fixture.category.getSlug()))
                .andExpect(jsonPath("$.totalElements").value(0));
        assertThat(allProductIds()).doesNotContain(id).hasSize(60);
        mvc.perform(post("/api/v1/products/" + id + "/contact-click").with(newIp())).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/products/" + id + "/reports").with(newIp()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"FAKE\"}")).andExpect(status().isNotFound());
        assertThat(categoryCount(fixture.category.getSlug())).isIn(0L, null);
        if (fixture.store.getStatus() == StoreStatus.APPROVED) {
            mvc.perform(get("/api/v1/stores/" + fixture.store.getSlug())).andExpect(jsonPath("$.productCount").value(0));
        } else {
            mvc.perform(get("/api/v1/stores/" + fixture.store.getSlug())).andExpect(status().isNotFound());
            mvc.perform(get("/api/v1/stores/" + fixture.store.getSlug() + "/products")).andExpect(status().isNotFound());
        }
    }

    @Test
    void theSameSetUpIsVisibleWhenNothingIsHidden() throws Exception {
        Fixture fixture = new Fixture();
        Product product = fixture.listed();
        em.flush();
        em.clear();

        mvc.perform(get("/api/v1/products/" + product.getSlug())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/products?ids=" + product.getId())).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/v1/products?store=" + fixture.store.getSlug())).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/products?category=" + fixture.category.getSlug()))
                .andExpect(jsonPath("$.totalElements").value(1));
        assertThat(allProductIds()).contains(product.getId()).hasSize(61);
        assertThat(categoryCount(fixture.category.getSlug())).isEqualTo(1L);
        mvc.perform(get("/api/v1/stores/" + fixture.store.getSlug())).andExpect(jsonPath("$.productCount").value(1));
    }

    @Test
    void inactiveCategoriesAndTheirSubtreesLeaveTheTree() throws Exception {
        Category parent = data.category();
        Category child = new Category(parent, "child-" + TestData.next(), LocalizedText.of("Alt", "Sub", "Под"), 1);
        em.persist(child);
        parent.setActive(false);
        em.flush();
        em.clear();

        String body = mvc.perform(get("/api/v1/categories")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain(parent.getSlug()).doesNotContain(child.getSlug());
        mvc.perform(get("/api/v1/products?category=" + child.getSlug())).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void subcategoryProductsCountForTheParent() throws Exception {
        Fixture fixture = new Fixture();
        String parentSlug = fixture.category.getSlug();
        Category child = new Category(fixture.category, "child-" + TestData.next(),
                LocalizedText.of("Alt", "Sub", "Под"), 1);
        em.persist(child);
        fixture.listed();
        fixture.category = child;
        fixture.listed();
        fixture.listed();
        em.flush();
        em.clear();

        assertThat(categoryCount(child.getSlug())).isEqualTo(2L);
        assertThat(categoryCount(parentSlug)).isEqualTo(3L);
        mvc.perform(get("/api/v1/products?size=96&category=" + child.getSlug())).andExpect(jsonPath("$.totalElements").value(2));
        // The demo root "Üzüklər" counts its two subcategories.
        assertThat(categoryCount("uzukler")).isEqualTo(12L);
    }

    /** A fresh client address per request: the report and click limits are per IP. */
    private static RequestPostProcessor newIp() {
        int n = TestData.next();
        return request -> {
            request.setRemoteAddr("10.38." + (n / 250 % 250) + "." + (n % 250 + 1));
            return request;
        };
    }

    private java.util.List<Long> allProductIds() throws Exception {
        JsonNode page = JSON.readTree(mvc.perform(get("/api/v1/products?size=96")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8));
        java.util.List<Long> ids = new java.util.ArrayList<>();
        page.get("content").forEach(card -> ids.add(card.get("id").longValue()));
        return ids;
    }

    /** productCount of a category in GET /categories, or null when the category is not listed. */
    private Long categoryCount(String slug) throws Exception {
        JsonNode categories = JSON.readTree(mvc.perform(get("/api/v1/categories")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8));
        for (JsonNode category : categories) {
            if (category.get("slug").stringValue().equals(slug)) {
                return category.get("productCount").longValue();
            }
        }
        return null;
    }
}
