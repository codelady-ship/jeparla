package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import az.jeparla.support.TestData;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code GET /api/v1/products}, {@code /products/{slug}}, {@code /products?ids=} and {@code /variants?ids=}
 * on the demo seed (60 products, 6 stores): filters, sorting, pagination edges, validation and 404s.
 * Expected filter results are counted with plain SQL over the same rows.
 */
@CatalogApiTest
class ProductCatalogApiTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    /** Listed products: what the public catalog may show, as SQL over products {@code p} and stores {@code s}. */
    private static final String LISTED = """
            SELECT count(*) FROM products p JOIN stores s ON s.id = p.store_id JOIN categories c ON c.id = p.category_id
            WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL AND s.status = 'APPROVED' AND c.active
              AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL)
            """;
    private static final String DIAMOND = "EXISTS (SELECT 1 FROM product_stones d WHERE d.product_id = p.id"
            + " AND d.stone_type = 'DIAMOND' AND ";
    private static final String VARIANT = "EXISTS (SELECT 1 FROM product_variants v JOIN finenesses f ON f.id = v.fineness_id"
            + " WHERE v.product_id = p.id AND v.deleted_at IS NULL AND ";
    private static final String PRICE_FROM =
            "(SELECT min(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL)";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private TestData data;

    @Autowired
    private EntityManager em;

    private JsonNode getJson(String request) throws Exception {
        String body = mvc.perform(get(URI.create(request))).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return JSON.readTree(body);
    }

    private static List<Long> ids(JsonNode page) {
        List<Long> ids = new ArrayList<>();
        page.get("content").forEach(card -> ids.add(card.get("id").longValue()));
        return ids;
    }

    // ------------------------------------------------------------------ filters

    static Stream<Arguments> filters() {
        return Stream.of(
                Arguments.of("shape=PRINCESS", DIAMOND + "d.shape = 'PRINCESS')"),
                Arguments.of("color=D&color=G", DIAMOND + "d.color IN ('D', 'G'))"),
                Arguments.of("clarity=VVS2,SI1", DIAMOND + "d.clarity IN ('VVS2', 'SI1'))"),
                Arguments.of("minCarat=0.25&maxCarat=0.5", DIAMOND + "d.carat BETWEEN 0.25 AND 0.5)"),
                // Shape and carat must hold for the same stone: round demo diamonds are 0.10 ct.
                Arguments.of("shape=ROUND&minCarat=0.2", DIAMOND + "d.shape = 'ROUND' AND d.carat >= 0.2)"),
                Arguments.of("metal=SILVER", "p.metal = 'SILVER'"),
                Arguments.of("fineness=585&fineness=999", VARIANT + "f.value IN (585, 999))"),
                Arguments.of("minWeight=2&maxWeight=4", VARIANT + "v.weight_grams BETWEEN 2 AND 4)"),
                Arguments.of("minPrice=100&maxPrice=500", PRICE_FROM + " BETWEEN 100 AND 500"),
                Arguments.of("maxPrice=99.99", PRICE_FROM + " <= 99.99"),
                Arguments.of("city=G%C9%99nc%C9%99", "s.city = 'Gəncə'"),
                Arguments.of("verified=true", "s.documents_status = 'VERIFIED'"),
                Arguments.of("verified=false", "TRUE"),
                Arguments.of("inStock=true", VARIANT + "v.stock_status <> 'OUT_OF_STOCK')"),
                Arguments.of("category=boyunbagilar", "p.category_id IN (5, 6, 7)"),
                Arguments.of("category=zencirler", "p.category_id = 6"),
                Arguments.of("store=nergiz-gold&store=yeni-ulduz", "s.slug IN ('nergiz-gold', 'yeni-ulduz')"),
                Arguments.of("store=nergiz-gold&metal=GOLD&inStock=true&minPrice=200&verified=false",
                        "s.slug = 'nergiz-gold' AND p.metal = 'GOLD' AND " + VARIANT
                                + "v.stock_status <> 'OUT_OF_STOCK') AND " + PRICE_FROM + " >= 200"),
                Arguments.of("category=uzukler&metal=GOLD&shape=OVAL&city=Bak%C4%B1",
                        "p.category_id IN (1, 2, 3) AND p.metal = 'GOLD' AND s.city = 'Bakı' AND " + DIAMOND
                                + "d.shape = 'OVAL')"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("filters")
    void filtersCombineLikeTheSqlDefinition(String query, String condition) throws Exception {
        long expected = jdbc.queryForObject(LISTED + " AND " + condition, Long.class);
        JsonNode page = getJson("/api/v1/products?size=96&" + query);
        assertThat(page.get("totalElements").longValue()).as(query).isEqualTo(expected);
        assertThat(page.get("content").size()).isEqualTo((int) expected);
    }

    @Test
    void theFiltersUsedByTheTestsAreNotTrivial() {
        assertThat(jdbc.queryForObject(LISTED, Long.class)).isEqualTo(60);
        assertThat(jdbc.queryForObject(LISTED + " AND " + DIAMOND + "d.shape = 'PRINCESS')", Long.class))
                .isBetween(1L, 59L);
        assertThat(jdbc.queryForObject(LISTED + " AND s.documents_status = 'VERIFIED'", Long.class)).isBetween(1L, 59L);
        assertThat(jdbc.queryForObject(LISTED + " AND " + VARIANT + "v.stock_status <> 'OUT_OF_STOCK')", Long.class))
                .isBetween(1L, 59L);
    }

    @Test
    void wordSearchFoldsAzerbaijaniLettersAndCase() throws Exception {
        JsonNode folded = getJson("/api/v1/products?size=96&q=qizil+uzuk");
        JsonNode written = getJson("/api/v1/products?size=96&q=Q%C4%B1z%C4%B1l+%C3%BCz%C3%BCk");
        assertThat(folded.get("totalElements").longValue()).isPositive();
        assertThat(ids(written)).isEqualTo(ids(folded));
        // Store and category names count too.
        assertThat(getJson("/api/v1/products?size=96&q=semender").get("totalElements").longValue()).isEqualTo(10);
        assertThat(getJson("/api/v1/products?size=96&q=zencir").get("totalElements").longValue())
                .isEqualTo(jdbc.queryForObject(LISTED + " AND p.category_id = 6", Long.class));
        assertThat(getJson("/api/v1/products?q=xyzxyz").get("totalElements").longValue()).isZero();
    }

    // ------------------------------------------------------------------ sorting and pagination

    @ParameterizedTest
    @ValueSource(strings = {"relevance", "newest", "price_asc", "price_desc", "weight_asc"})
    void pagesAreStableAndCoverEveryProductOnce(String sort) throws Exception {
        List<Long> seen = new ArrayList<>();
        for (int page = 0; page < 7; page++) {
            JsonNode body = getJson("/api/v1/products?size=9&sort=" + sort + "&page=" + page);
            assertThat(body.get("totalElements").longValue()).isEqualTo(60);
            assertThat(body.get("totalPages").intValue()).isEqualTo(7);
            assertThat(body.get("page").intValue()).isEqualTo(page);
            assertThat(body.get("size").intValue()).isEqualTo(9);
            seen.addAll(ids(body));
        }
        assertThat(seen).hasSize(60).doesNotHaveDuplicates();
        assertThat(ids(getJson("/api/v1/products?size=9&sort=" + sort + "&page=3")))
                .as("same request, same page").isEqualTo(seen.subList(27, 36));
    }

    @Test
    void sortOrdersFollowTheCard() throws Exception {
        assertSorted(getJson("/api/v1/products?size=96&sort=price_asc"), "priceFrom", 1);
        assertSorted(getJson("/api/v1/products?size=96&sort=price_desc"), "priceFrom", -1);
        assertSorted(getJson("/api/v1/products?size=96&sort=weight_asc"), "weightGrams", 1);
        JsonNode newest = getJson("/api/v1/products?size=96&sort=newest");
        List<Instant> published = new ArrayList<>();
        newest.get("content").forEach(card -> published.add(Instant.parse(card.get("publishedAt").stringValue())));
        assertThat(published).isSortedAccordingTo((a, b) -> b.compareTo(a));
        assertThat(ids(getJson("/api/v1/products?size=96"))).isSorted();
    }

    private static void assertSorted(JsonNode page, String field, int direction) {
        List<BigDecimal> values = new ArrayList<>();
        page.get("content").forEach(card -> {
            JsonNode value = card.get(field);
            values.add(new BigDecimal(value.isObject() ? value.get("amount").stringValue() : value.stringValue()));
        });
        assertThat(values).hasSize(60).isSortedAccordingTo((a, b) -> direction * a.compareTo(b));
    }

    @Test
    void priceSortAndPriceFilterUseTheLowestLiveVariant() throws Exception {
        Product product = data.publicProduct(data.approvedStore(data.merchant()), data.category(),
                data.fineness(Metal.GOLD), "5000.00");
        Fineness fineness = product.getVariants().getFirst().getFineness();
        ProductVariant cheap = new ProductVariant("CHEAP-" + TestData.next(), fineness, new BigDecimal("1.500"),
                new BigDecimal("10.00"), az.jeparla.common.Currencies.AZN, Instant.parse("2026-11-03T06:05:00Z"));
        product.addVariant(cheap);
        ProductVariant removed = new ProductVariant("GONE-" + TestData.next(), fineness, new BigDecimal("1.000"),
                new BigDecimal("1.00"), az.jeparla.common.Currencies.AZN, Instant.parse("2026-11-03T06:05:00Z"));
        product.addVariant(removed);
        em.flush();
        product.removeVariant(removed, Instant.parse("2026-11-04T06:05:00Z"));
        em.flush();
        em.clear();
        String store = product.getStore().getSlug();

        JsonNode card = getJson("/api/v1/products?store=" + store).get("content").get(0);
        assertThat(card.get("priceFrom").get("amount").stringValue()).isEqualTo("10.00");
        assertThat(card.get("defaultVariantId").longValue()).isEqualTo(cheap.getId());
        assertThat(card.get("weightGrams").stringValue()).isEqualTo("1.500");
        assertThat(getJson("/api/v1/products?minPrice=1000&store=" + store).get("totalElements").longValue()).isZero();
        assertThat(getJson("/api/v1/products?maxPrice=10&store=" + store).get("totalElements").longValue()).isOne();
        JsonNode detail = getJson("/api/v1/products/" + product.getSlug());
        assertThat(detail.get("variants")).hasSize(2);

        JsonNode cheapest = getJson("/api/v1/products?size=1&sort=price_asc").get("content").get(0);
        assertThat(cheapest.get("id").longValue()).isEqualTo(product.getId());
    }

    @Test
    void aPageAfterTheLastIsEmptyAndKeepsTheTotals() throws Exception {
        mvc.perform(get("/api/v1/products?page=40&size=24"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.page").value(40))
                .andExpect(jsonPath("$.totalElements").value(60))
                .andExpect(jsonPath("$.totalPages").value(3));
        mvc.perform(get("/api/v1/products?size=96"))
                .andExpect(jsonPath("$.content", hasSize(60)))
                .andExpect(jsonPath("$.totalPages").value(1));
        mvc.perform(get("/api/v1/products?size=1"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.totalPages").value(60));
    }

    // ------------------------------------------------------------------ validation

    @ParameterizedTest
    @ValueSource(strings = {"size=0", "size=97", "page=-1", "page=10001", "sort=cheapest", "metal=COPPER",
            "minPrice=abc", "minPrice=-1", "minWeight=1.2345", "fineness=0", "fineness=abc", "inStock=maybe",
            "minCarat=-0.1"})
    void invalidParametersGiveAValidationProblem(String query) throws Exception {
        String field = query.substring(0, query.indexOf('='));
        mvc.perform(get("/api/v1/products?" + query).header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("application/problem+json")))
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.errors[0].field", startsWith(field)));
    }

    @Test
    void aTooLongQueryIsRejected() throws Exception {
        mvc.perform(get("/api/v1/products?q=" + "a".repeat(101))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
        mvc.perform(get("/api/v1/products?q=" + "a".repeat(100))).andExpect(status().isOk());
    }

    @Test
    void anInvertedRangeIsALocalizedProblem() throws Exception {
        mvc.perform(get("/api/v1/products?minWeight=5&maxWeight=1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("catalog.invalid_range"))
                .andExpect(jsonPath("$.errors[0].field").value("maxWeight"))
                .andExpect(jsonPath("$.detail").value("Minimum dəyər maksimumdan böyük ola bilməz."));
        mvc.perform(get("/api/v1/products?minPrice=500&maxPrice=100").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(jsonPath("$.errors[0].field").value("maxPrice"))
                .andExpect(jsonPath("$.detail").value("The minimum must not be greater than the maximum."));
        mvc.perform(get("/api/v1/products?minCarat=1&maxCarat=0.5").header(HttpHeaders.ACCEPT_LANGUAGE, "ru"))
                .andExpect(jsonPath("$.errors[0].field").value("maxCarat"))
                .andExpect(jsonPath("$.title").value("Неверный запрос"));
    }

    @Test
    void acceptLanguageNeverChangesData() throws Exception {
        String az = mvc.perform(get("/api/v1/products?size=5").header(HttpHeaders.ACCEPT_LANGUAGE, "az"))
                .andExpect(header().doesNotExist("Content-Language")).andReturn().getResponse().getContentAsString();
        String ru = mvc.perform(get("/api/v1/products?size=5").header(HttpHeaders.ACCEPT_LANGUAGE, "ru"))
                .andReturn().getResponse().getContentAsString();
        assertThat(ru).isEqualTo(az);
        JsonNode name = JSON.readTree(az).get("content").get(0).get("name");
        assertThat(name.propertyNames()).containsExactlyInAnyOrder("az", "en", "ru");
    }

    // ------------------------------------------------------------------ single product, ids, compare

    @Test
    void productPageHasVariantsStonesAndPricingRule() throws Exception {
        mvc.perform(get("/api/v1/products/nisan-uzukleri-gold-585-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.priceFrom.amount").value("508.75"))
                .andExpect(jsonPath("$.priceFrom.currency").value("AZN"))
                .andExpect(jsonPath("$.weightGrams").value("1.200"))
                .andExpect(jsonPath("$.variants[0].id").value(10))
                .andExpect(jsonPath("$.variants[0].pricing.markupPercent").value("15.00"))
                .andExpect(jsonPath("$.variants[0].fineness.value").value(585))
                .andExpect(jsonPath("$.stones[0].type").value("DIAMOND"))
                .andExpect(jsonPath("$.stones[0].carat").value("0.100"))
                .andExpect(jsonPath("$.description.en").value(startsWith("Leyla")));
        mvc.perform(get("/api/v1/products/sirgalar-gold-585-3"))
                .andExpect(jsonPath("$.pricingMode").value("FIXED"))
                .andExpect(jsonPath("$.variants[0].pricing").isEmpty());
    }

    /** #104: the breakdown's total is the variant price, and its parts are those of the seller's rule. */
    @Test
    void everyVariantExplainsItsPrice() throws Exception {
        JsonNode product = JSON.readTree(mvc.perform(get("/api/v1/products/nisan-uzukleri-gold-585-1"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        String gramPrice = jdbc.queryForObject("select s.price_per_gram::text from product_variants v"
                + " join metal_price_snapshots s on s.id = v.metal_snapshot_id where v.id = ?", String.class,
                product.get("variants").get(0).get("id").longValue());
        for (JsonNode variant : product.get("variants")) {
            JsonNode breakdown = variant.get("priceBreakdown");
            JsonNode rule = variant.get("pricing");
            assertThat(breakdown.get("total")).isEqualTo(variant.get("price"));
            assertThat(breakdown.get("metal").get("fineness").intValue())
                    .isEqualTo(variant.get("fineness").get("value").intValue());
            assertThat(breakdown.get("metal").get("weightGrams")).isEqualTo(variant.get("weightGrams"));
            assertThat(breakdown.get("metal").get("gramPrice").get("amount").stringValue()).isEqualTo(gramPrice);
            assertThat(breakdown.get("metal").get("source").stringValue()).isEqualTo("CBAR");
            assertThat(breakdown.get("metal").get("quoteDate").stringValue()).matches("\\d{4}-\\d{2}-\\d{2}");
            assertThat(breakdown.get("labor").get("perGram").get("amount")).isEqualTo(rule.get("laborPerGram"));
            assertThat(breakdown.get("labor").get("fixed").get("amount")).isEqualTo(rule.get("laborFixed"));
            assertThat(breakdown.get("stone").get("amount")).isEqualTo(rule.get("stonePrice"));
            assertThat(breakdown.get("markup").get("percent")).isEqualTo(rule.get("markupPercent"));
            BigDecimal metal = new BigDecimal(variant.get("weightGrams").stringValue())
                    .multiply(BigDecimal.valueOf(variant.get("fineness").get("value").intValue()))
                    .divide(BigDecimal.valueOf(1000)).multiply(new BigDecimal(gramPrice))
                    .setScale(2, java.math.RoundingMode.HALF_UP);
            assertThat(new BigDecimal(breakdown.get("metal").get("value").get("amount").stringValue()))
                    .isEqualByComparingTo(metal);
        }

        mvc.perform(get("/api/v1/products/sirgalar-gold-585-3"))
                .andExpect(jsonPath("$.variants[0].priceBreakdown.total").value(org.hamcrest.Matchers.notNullValue()))
                .andExpect(jsonPath("$.variants[0].priceBreakdown.metal").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.variants[0].priceBreakdown.labor").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.variants[0].priceBreakdown.stone").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.variants[0].priceBreakdown.markup").value(org.hamcrest.Matchers.nullValue()));
        mvc.perform(get("/api/v1/variants?ids=10"))
                .andExpect(jsonPath("$[0].variant.priceBreakdown.metal.fineness").value(585));
    }

    @Test
    void unknownProductsAre404() throws Exception {
        mvc.perform(get("/api/v1/products/no-such-product").header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"))
                .andExpect(jsonPath("$.title").value("Not found"));
    }

    @Test
    void idsKeepTheRequestedOrderAndDropUnknownOnes() throws Exception {
        JsonNode cards = getJson("/api/v1/products?ids=5,999999,2,5");
        List<Long> ids = new ArrayList<>();
        cards.forEach(card -> ids.add(card.get("id").longValue()));
        assertThat(ids).containsExactly(5L, 2L, 5L);
        mvc.perform(get("/api/v1/products?ids=" + "1,".repeat(100) + "1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/products?ids=1,x")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("ids"));
    }

    /** #141: empty elements were a 500 (Map.of().get(null)); now they are ignored. */
    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "/api/v1/products?ids=,         | ",
            "/api/v1/products?ids=,,,       | ",
            "/api/v1/products?ids=%20       | ",
            "/api/v1/products?ids=          | ",
            "/api/v1/products?ids=1,,2      | 1,2",
            "/api/v1/products?ids=,2,%201,  | 2,1",
            "/api/v1/variants?ids=,         | ",
            "/api/v1/variants?ids=10,,20    | 1,2",
    })
    void emptyIdElementsAreIgnored(String request, String expectedProductIds) throws Exception {
        JsonNode items = getJson(request);
        List<Long> productIds = new ArrayList<>();
        items.forEach(item -> productIds.add((item.has("product") ? item.get("product") : item).get("id").longValue()));
        List<Long> expected = expectedProductIds == null ? List.of()
                : Stream.of(expectedProductIds.split(",")).map(Long::valueOf).toList();
        assertThat(productIds).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "/api/v1/products?ids=0                     | catalog.invalid_ids",
            "/api/v1/products?ids=-1                    | catalog.invalid_ids",
            "/api/v1/products?ids=1,abc                 | catalog.invalid_ids",
            "/api/v1/products?ids=1.5                   | catalog.invalid_ids",
            "/api/v1/products?ids=99999999999999999999  | catalog.invalid_ids",
            "/api/v1/products?ids=0x10                  | catalog.invalid_ids",
            "/api/v1/variants?ids=,x                    | catalog.invalid_ids",
            "/api/v1/variants?ids=1,2,3,4,5             | catalog.too_many_ids",
    })
    void invalidIdsAreABadRequest(String request, String code) throws Exception {
        mvc.perform(get(URI.create(request)).header(HttpHeaders.ACCEPT_LANGUAGE, "en"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.title").value("Bad request"))
                .andExpect(jsonPath("$.errors[0].field").value("ids"));
    }

    @Test
    void compareReturnsVariantsInTheRequestedOrder() throws Exception {
        JsonNode items = getJson("/api/v1/variants?ids=30,10,999990");
        assertThat(items).hasSize(2);
        assertThat(items.get(0).get("variant").get("id").longValue()).isEqualTo(30);
        assertThat(items.get(0).get("product").get("id").longValue()).isEqualTo(3);
        assertThat(items.get(1).get("stones")).hasSize(1);
        mvc.perform(get("/api/v1/variants?ids=10,20,30,40,50")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/variants")).andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ images

    @Test
    void imageUrlsNeverCarryTheDemoFragment() throws Exception {
        assertThat(jdbc.queryForObject("SELECT storage_key FROM product_images WHERE product_id = 1 AND sort_order = 0",
                String.class)).isEqualTo("demo/ring-gold-1.jpg#1-0");
        mvc.perform(get("/api/v1/products/nisan-uzukleri-gold-585-1"))
                .andExpect(jsonPath("$.images[0].url").value("/demo/ring-gold-1.jpg"))
                .andExpect(jsonPath("$.images[0].alt.az").value(startsWith("Leyla")))
                .andExpect(jsonPath("$.images[0].aiGenerated").value(false));

        String all = mvc.perform(get("/api/v1/products?size=96")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(all).doesNotContain("#");
        Set<String> urls = new HashSet<>();
        JSON.readTree(all).get("content").forEach(card -> card.get("images")
                .forEach(image -> urls.add(image.get("url").stringValue())));
        assertThat(urls).isNotEmpty().allSatisfy(url -> assertThat(url).matches("/demo/[a-z]+-(gold|silver)-\\d\\.jpg"));
    }

    @Test
    void theDatabaseRejectsAFragmentOutsideDemoKeys() {
        Product product = data.publicProduct(data.approvedStore(data.merchant()), data.category(),
                data.fineness(Metal.GOLD), "100.00");
        em.flush();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
                "UPDATE product_images SET storage_key = 'products/x.webp#1' WHERE product_id = ?", product.getId()))
                .hasMessageContaining("product_images_storage_key_fragment");
    }

    // ------------------------------------------------------------------ cache headers

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/products", "/api/v1/products/nisan-uzukleri-gold-585-1", "/api/v1/products?ids=1,2",
            "/api/v1/variants?ids=10", "/api/v1/categories", "/api/v1/finenesses", "/api/v1/stores",
            "/api/v1/stores/ayzer-zerger", "/api/v1/stores/ayzer-zerger/products", "/api/v1/metal-prices/latest",
            "/api/v1/metal-prices/history?metal=GOLD"})
    void publicResponsesAreCacheableByACdnWithAnEtag(String request) throws Exception {
        var response = mvc.perform(get(URI.create(request)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("public")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("max-age=")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("s-maxage=")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("stale-while-revalidate=")))
                .andExpect(header().doesNotExist(HttpHeaders.PRAGMA))
                .andExpect(header().exists(HttpHeaders.ETAG))
                .andReturn().getResponse();
        assertThat(response.getHeaders(HttpHeaders.VARY)).noneMatch(v -> v.contains("Accept-Language"));
        String etag = response.getHeader(HttpHeaders.ETAG);
        mvc.perform(get(URI.create(request)).header(HttpHeaders.IF_NONE_MATCH, etag))
                .andExpect(status().isNotModified());
    }

    @Test
    void catalogCachePolicyValues() throws Exception {
        mvc.perform(get("/api/v1/products"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        "max-age=60, public, s-maxage=300, stale-while-revalidate=600"));
        mvc.perform(get("/api/v1/categories"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        "max-age=300, public, s-maxage=3600, stale-while-revalidate=86400"));
    }

    @Test
    void errorsAreNeverCached() throws Exception {
        mvc.perform(get("/api/v1/products/no-such-product"))
                .andExpect(status().isNotFound())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(header().doesNotExist(HttpHeaders.ETAG));
        mvc.perform(get("/api/v1/products?size=0"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(header().doesNotExist(HttpHeaders.ETAG));
    }
}
