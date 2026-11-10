package az.jeparla.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.support.CatalogApiTest;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code GET /api/v1/search} and {@code /search/suggest} (#38) on the demo catalog: letter folding,
 * Russian names, typos, synonyms, ranking, visibility, paging, validation, caching and the rate
 * limit. The frontend contract (same JSON as the mock) is in CatalogContractTests.
 */
@CatalogApiTest
class SearchApiTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private RateLimitService rateLimits;

    private JsonNode search(String q, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/search").param("q", q);
        for (int i = 0; i + 1 < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return json(request);
    }

    private JsonNode suggest(String q) throws Exception {
        return json(get("/api/v1/search/suggest").param("q", q));
    }

    private JsonNode json(MockHttpServletRequestBuilder request) throws Exception {
        String body = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return JSON.readTree(body);
    }

    private static List<String> slugs(JsonNode items) {
        List<String> slugs = new ArrayList<>();
        items.forEach(item -> slugs.add(item.get("slug").stringValue()));
        return slugs;
    }

    private static List<Long> ids(JsonNode items) {
        List<Long> ids = new ArrayList<>();
        items.forEach(item -> ids.add(item.get("id").longValue()));
        return ids;
    }

    /** All matching product ids (one page of 96 holds the demo results). */
    private List<Long> productIds(String q) throws Exception {
        JsonNode products = search(q, "type", "products", "size", "96").get("products");
        assertThat(products.get("totalElements").longValue()).isLessThanOrEqualTo(96);
        return ids(products.get("content"));
    }

    // ------------------------------------------------------------------ letters, languages, typos

    @Test
    void uzukUzukAndUzkFindTheSameRings() throws Exception {
        JsonNode exact = search("üzük", "size", "96");
        assertThat(slugs(exact.get("categories"))).containsExactly("uzukler", "nisan-uzukleri", "toy-uzukleri");
        assertThat(exact.get("products").get("totalElements").longValue()).isPositive();
        for (String q : List.of("uzuk", "UZUK", "Üzük", "uzk")) {
            JsonNode other = search(q, "size", "96");
            assertThat(slugs(other.get("categories"))).as(q).isEqualTo(slugs(exact.get("categories")));
            assertThat(new HashSet<>(ids(other.get("products").get("content")))).as(q)
                    .isEqualTo(new HashSet<>(ids(exact.get("products").get("content"))));
        }
    }

    @ParameterizedTest
    @CsvSource({"qizil, qızıl", "sirga, sırğa", "gumus, gümüş", "zencir, zəncir", "nisan, Nişan", "SIRĞA, sırğa"})
    void azerbaijaniLettersTypedWithoutDiacriticsFindTheSame(String plain, String proper) throws Exception {
        JsonNode a = search(plain, "size", "96");
        JsonNode b = search(proper, "size", "96");
        assertThat(slugs(a.get("categories"))).isEqualTo(slugs(b.get("categories")));
        assertThat(ids(a.get("products").get("content"))).isEqualTo(ids(b.get("products").get("content")))
                .isNotEmpty();
    }

    @Test
    void aStoreSearchedByItsNameComesFirst() throws Exception {
        for (String q : List.of("Ayzər", "ayzer", "AYZƏR ZƏRGƏR", "ayzər zərgər")) {
            JsonNode result = search(q);
            assertThat(result.get("stores")).as(q).hasSize(1);
            assertThat(result.get("stores").get(0).get("slug").stringValue()).isEqualTo("ayzer-zerger");
            assertThat(suggest(q).get("stores").get(0).get("slug").stringValue()).isEqualTo("ayzer-zerger");
        }
        // Both stores named "... Zərgər" match; the one whose name starts with the query is first.
        assertThat(slugs(search("Səməndər zərgər").get("stores"))).first().isEqualTo("semender-zerger");
        assertThat(slugs(search("zərgər").get("stores"))).containsExactly("ayzer-zerger", "semender-zerger");
    }

    @Test
    void aCategorySearchedByItsNameComesFirst() throws Exception {
        assertThat(slugs(search("sırğa").get("categories"))).containsExactly("sirgalar");
        assertThat(slugs(search("Toy üzükləri").get("categories"))).first().isEqualTo("toy-uzukleri");
        assertThat(slugs(search("üzüklər").get("categories"))).first().isEqualTo("uzukler");
        assertThat(slugs(suggest("toy").get("categories"))).containsExactly("toy-uzukleri");
    }

    @Test
    void russianAndEnglishQueriesMatchTheirNames() throws Exception {
        assertThat(slugs(search("серьги").get("categories"))).first().isEqualTo("sirgalar");
        assertThat(slugs(search("Кольца").get("categories"))).first().isEqualTo("uzukler");
        // "кольцо" is not a prefix of "кольца": the synonym (V11) and trigram similarity find the rings.
        assertThat(slugs(search("кольцо").get("categories"))).contains("uzukler", "nisan-uzukleri", "toy-uzukleri");
        assertThat(slugs(search("earrings").get("categories"))).first().isEqualTo("sirgalar");
        assertThat(productIds("цепочка")).isNotEmpty().isEqualTo(productIds("zəncir"));
    }

    @Test
    void typosAreTolerated() throws Exception {
        assertThat(slugs(search("ayzar").get("stores"))).containsExactly("ayzer-zerger");
        assertThat(slugs(search("sirgalr").get("categories"))).first().isEqualTo("sirgalar");
        assertThat(slugs(search("qolbaqlr").get("categories"))).first().isEqualTo("qolbaqlar");
        // Two-letter words only match as a word start, so they do not drag in random typos.
        assertThat(slugs(search("qx").get("categories"))).isEmpty();
    }

    @Test
    void exactAndPrefixMatchesRankAboveTypos() throws Exception {
        // "sırğa" is a whole word of the 6 earrings and only the start of "sırğası" (kids' earrings).
        JsonNode content = search("sırğa").get("products").get("content");
        List<Long> categories = new ArrayList<>();
        content.forEach(card -> categories.add(card.get("categoryId").longValue()));
        assertThat(categories).hasSize(12);
        assertThat(categories.subList(0, 6)).containsOnly(4L);
        assertThat(categories.subList(6, 12)).containsOnly(12L);
    }

    @Test
    void synonymsWorkBothWaysAndAdminRowsCount() throws Exception {
        assertThat(slugs(search("serqa").get("categories"))).containsExactly("sirgalar");
        assertThat(productIds("serqa")).containsExactlyInAnyOrderElementsOf(productIds("sırğa"));
        assertThat(slugs(search("halqa").get("categories"))).isEmpty();

        jdbc.update("INSERT INTO search_synonyms (term, synonym) VALUES ('halqa', 'Üzük')");
        assertThat(slugs(search("halqa").get("categories"))).contains("uzukler", "nisan-uzukleri", "toy-uzukleri");
        assertThat(jdbc.queryForObject("SELECT synonym_folded FROM search_synonyms WHERE term = 'halqa'", String.class))
                .isEqualTo("uzuk");
    }

    @Test
    void everyWordMustMatch() throws Exception {
        List<Long> goldRings = productIds("qızıl nişan");
        assertThat(goldRings).isNotEmpty();
        for (long id : goldRings) {
            String name = jdbc.queryForObject("SELECT search_text FROM products WHERE id = ?", String.class, id);
            assertThat(name).contains("qizil").contains("nisan");
        }
        assertThat(search("qızıl zzzqqq").get("products").get("totalElements").longValue()).isZero();
    }

    // ------------------------------------------------------------------ what is found

    @Test
    void onlyListedProductsStoresAndCategoriesAreFound() throws Exception {
        List<Long> before = productIds("sırğa");
        long draft = before.get(0);
        long noVariant = before.get(1);
        jdbc.update("UPDATE products SET status = 'DRAFT' WHERE id = ?", draft);
        jdbc.update("UPDATE product_variants SET deleted_at = now() WHERE product_id = ?", noVariant);
        assertThat(productIds("sırğa")).hasSize(before.size() - 2).doesNotContain(draft, noVariant);

        jdbc.update("UPDATE categories SET active = FALSE WHERE slug = 'sirgalar'");
        assertThat(search("sırğa").get("categories")).isEmpty();
        assertThat(productIds("sırğa")).allMatch(id -> categoryOf(id) == 12L);

        jdbc.update("UPDATE stores SET status = 'BLOCKED' WHERE slug = 'ayzer-zerger'");
        assertThat(search("Ayzər").get("stores")).isEmpty();
        assertThat(search("Ayzər").get("products").get("totalElements").longValue()).isZero();
        assertThat(suggest("Ayzər").get("stores")).isEmpty();
        assertThat(suggest("Ayzər").get("products")).isEmpty();

        // A hidden parent hides its subcategories too.
        jdbc.update("UPDATE categories SET active = FALSE WHERE slug = 'uzukler'");
        assertThat(search("üzük").get("categories")).isEmpty();
        assertThat(suggest("toy").get("categories")).isEmpty();
    }

    private long categoryOf(long productId) {
        return jdbc.queryForObject("SELECT category_id FROM products WHERE id = ?", Long.class, productId);
    }

    @Test
    void storeAndCategoryCardsCarryTheirCounts() throws Exception {
        JsonNode store = search("Ayzər").get("stores").get(0);
        assertThat(store.get("productCount").longValue()).isEqualTo(10);
        JsonNode rings = search("üzüklər").get("categories").get(0);
        assertThat(rings.get("productCount").longValue()).isEqualTo(12);
        assertThat(rings.get("parentId").isNull()).isTrue();
    }

    @Test
    void typeFillsOnlyItsGroup() throws Exception {
        JsonNode stores = search("zərgər", "type", "stores");
        assertThat(stores.get("stores")).hasSize(2);
        assertThat(stores.get("categories")).isEmpty();
        assertThat(stores.get("products").get("content")).isEmpty();
        assertThat(stores.get("products").get("totalElements").longValue()).isZero();

        JsonNode categories = search("üzük", "type", "categories");
        assertThat(categories.get("stores")).isEmpty();
        assertThat(categories.get("categories")).hasSize(3);
        assertThat(categories.get("products").get("totalElements").longValue()).isZero();
    }

    @Test
    void aBlankQueryListsTheCatalog() throws Exception {
        for (String q : List.of("", "   ", "!!! ...")) {
            JsonNode result = search(q);
            assertThat(result.get("query").stringValue()).isEqualTo(q);
            assertThat(result.get("stores")).hasSize(6);
            assertThat(result.get("categories")).hasSize(12);
            assertThat(result.get("products").get("totalElements").longValue()).isEqualTo(60);
            assertThat(ids(result.get("products").get("content"))).first().isEqualTo(1L);
        }
        JsonNode missing = json(get("/api/v1/search"));
        assertThat(missing.get("query").stringValue()).isEmpty();
        assertThat(missing.get("products").get("totalElements").longValue()).isEqualTo(60);
    }

    // ------------------------------------------------------------------ paging

    @Test
    void productPagesAreStableAndKeepTheirTotals() throws Exception {
        JsonNode all = search("qızıl", "size", "96").get("products");
        long total = all.get("totalElements").longValue();
        assertThat(total).isGreaterThan(10);
        List<Long> paged = new ArrayList<>();
        for (int page = 0; page * 7 < total; page++) {
            JsonNode products = search("qızıl", "size", "7", "page", String.valueOf(page)).get("products");
            assertThat(products.get("totalElements").longValue()).isEqualTo(total);
            assertThat(products.get("totalPages").intValue()).isEqualTo((int) ((total + 6) / 7));
            assertThat(products.get("page").intValue()).isEqualTo(page);
            paged.addAll(ids(products.get("content")));
        }
        assertThat(paged).isEqualTo(ids(all.get("content")));
        assertThat(new HashSet<>(paged)).hasSize((int) total);

        JsonNode after = search("qızıl", "size", "7", "page", "500").get("products");
        assertThat(after.get("content")).isEmpty();
        assertThat(after.get("totalElements").longValue()).isEqualTo(total);
        assertThat(search("qızıl").get("products").get("size").intValue()).isEqualTo(24);
    }

    // ------------------------------------------------------------------ suggestions

    @Test
    void suggestionsAreFewAndCarryThePrice() throws Exception {
        JsonNode result = suggest("qızıl");
        assertThat(result.get("query").stringValue()).isEqualTo("qızıl");
        assertThat(result.get("products")).hasSize(SearchService.SUGGESTIONS);
        for (JsonNode product : result.get("products")) {
            JsonNode page = json(get("/api/v1/products/" + product.get("slug").stringValue()));
            assertThat(product.get("priceFrom")).isEqualTo(page.get("priceFrom"));
            assertThat(product.get("name")).isEqualTo(page.get("name"));
            assertThat(product.propertyNames()).containsExactlyInAnyOrder("slug", "name", "priceFrom");
        }
        // The same ranking as the search page: the suggestions are its first products.
        List<String> searched = slugs(search("qızıl").get("products").get("content")).subList(0, 5);
        assertThat(slugs(result.get("products"))).isEqualTo(searched);
        assertThat(suggest("Ayzər").get("stores").get(0).propertyNames())
                .containsExactlyInAnyOrder("slug", "name", "city");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  ", "-- ..."})
    void blankSuggestionsAreEmpty(String q) throws Exception {
        JsonNode result = suggest(q);
        assertThat(result.get("stores")).isEmpty();
        assertThat(result.get("categories")).isEmpty();
        assertThat(result.get("products")).isEmpty();
        assertThat(json(get("/api/v1/search/suggest")).get("query").stringValue()).isEmpty();
    }

    // ------------------------------------------------------------------ limits and errors

    @Test
    void aQueryOfAtMost100CharactersIsAccepted() throws Exception {
        String longest = "ş".repeat(100);
        assertThat(search(longest).get("products").get("totalElements").longValue()).isZero();
        assertThat(suggest(longest).get("products")).isEmpty();
        // More than 8 words: the rest is ignored, nothing breaks.
        assertThat(search("a b c d e f g h i j k l m n").get("query").stringValue()).startsWith("a b");
        // SQL and LIKE characters are not special: they fold to spaces.
        for (String q : List.of("%", "_", "' OR 1=1 --", "a%b_c\\d", "\u0000qızıl")) {
            search(q);
            suggest(q);
        }
        assertThat(productIds("\u0000qızıl%")).isEqualTo(productIds("qızıl"));
    }

    @ParameterizedTest
    @CsvSource({
            "/api/v1/search, q, 300",
            "/api/v1/search/suggest, q, 300",
            "/api/v1/search, q, 101",
            "/api/v1/search, type, nothing",
            "/api/v1/search, page, -1",
            "/api/v1/search, page, abc",
            "/api/v1/search, size, 0",
            "/api/v1/search, size, 97",
    })
    void invalidParametersAreRejectedWithALocalizedProblem(String path, String name, String value) throws Exception {
        String parameter = "q".equals(name) ? "ş".repeat(Integer.parseInt(value)) : value;
        mvc.perform(get(path).param(name, parameter).header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("application/problem+json")))
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.errors[0].field").value(name));
        mvc.perform(get(path).param(name, parameter))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Sorğuda yanlış doldurulmuş sahələr var."));
    }

    @Test
    void resultsAreCacheableByACdn() throws Exception {
        for (String path : List.of("/api/v1/search", "/api/v1/search/suggest")) {
            String etag = mvc.perform(get(path).param("q", "qızıl"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("public")))
                    .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("s-maxage=300")))
                    .andReturn().getResponse().getHeader(HttpHeaders.ETAG);
            assertThat(etag).isNotBlank();
            mvc.perform(get(path).param("q", "qızıl").header(HttpHeaders.IF_NONE_MATCH, etag))
                    .andExpect(status().isNotModified());
        }
        mvc.perform(get("/api/v1/search").param("q", "ş".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
    }

    @Test
    void searchesAreRateLimitedPerClientAddress() throws Exception {
        String address = "203.0.113.38";
        for (int i = 0; i < CatalogApiTest.SEARCH_IP_LIMIT; i++) {
            rateLimits.check(RateLimitPolicy.SEARCH_IP, IpAddresses.rateLimitKey(address));
        }
        for (String path : List.of("/api/v1/search", "/api/v1/search/suggest")) {
            mvc.perform(get(path).param("q", "qızıl").with(request -> {
                request.setRemoteAddr(address);
                return request;
            }))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                    .andExpect(jsonPath("$.code").value("rate_limited"));
        }
        mvc.perform(get("/api/v1/search/suggest").param("q", "qızıl").with(request -> {
            request.setRemoteAddr("203.0.113.39");
            return request;
        })).andExpect(status().isOk());
    }
}
