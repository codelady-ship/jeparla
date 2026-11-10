package az.jeparla.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import az.jeparla.support.DatabaseSuperuser;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Search on a large catalog (#151): with 20 000 more listed products the ranked statements read the trigram GIN
 * index instead of scanning every product, and the results stay the same. The rows are committed (the planner
 * only sees analyzed, committed data) and removed again after the class; the other CatalogApiTest classes share
 * this database but never run at the same time. Skipped without Docker, mandatory in CI.
 */
@CatalogApiTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SearchIndexTests {

    private static final Logger log = LoggerFactory.getLogger(SearchIndexTests.class);
    private static final int EXTRA_PRODUCTS = 20_000;
    private static final String SLUG_PREFIX = "index-test-";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DatabaseSuperuser superuser;

    @Autowired
    private SearchSynonymRepository synonyms;

    @Autowired
    private SearchCache cache;

    @Autowired
    private PlatformTransactionManager transactions;

    private String ringsBefore;
    private String suggestionsBefore;

    @BeforeAll
    void addTwentyThousandListedBrooches() throws Exception {
        ringsBefore = body("/api/v1/search?q=uzuk&size=96");
        suggestionsBefore = body("/api/v1/search/suggest?q=uzu");
        // Copies of a demo brooch with names no query below matches, each with a live variant, in every store.
        jdbc.update("""
                INSERT INTO products (store_id, category_id, slug, name_az, name_en, name_ru, metal, status,
                                      expertise_status, submitted_at, published_at)
                SELECT s.id, b.category_id, ? || g, 'Broş nümunə ' || g, 'Brooch sample ' || g, 'Брошь ' || g,
                       b.metal, 'APPROVED', 'NONE', now(), now()
                FROM generate_series(1, ?) g
                         JOIN stores s ON s.id = (SELECT min(id) FROM stores WHERE status = 'APPROVED') + g % 3
                         CROSS JOIN (SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
                                     WHERE c.slug = 'broslar' ORDER BY p.id LIMIT 1) b
                """, SLUG_PREFIX, EXTRA_PRODUCTS);
        jdbc.update("""
                INSERT INTO product_variants (product_id, store_id, sku, fineness_id, weight_grams, price, currency)
                SELECT p.id, p.store_id, 'IDX-' || p.id, v.fineness_id, v.weight_grams, v.price, v.currency
                FROM products p
                         CROSS JOIN (SELECT v.* FROM product_variants v JOIN products b ON b.id = v.product_id
                                              JOIN categories c ON c.id = b.category_id
                                     WHERE c.slug = 'broslar' ORDER BY v.id LIMIT 1) v
                WHERE p.slug LIKE ? || '%'
                """, SLUG_PREFIX);
        // Statistics as autovacuum would have them; only the table owner (or a superuser) may analyze.
        superuser.jdbc().execute("ANALYZE products, product_variants, stores, categories");
    }

    @AfterAll
    void removeThem() {
        superuser.jdbc().execute("SET session_replication_role = replica;"
                + " DELETE FROM product_variants WHERE sku LIKE 'IDX-%';"
                + " DELETE FROM products WHERE slug LIKE '" + SLUG_PREFIX + "%';"
                + " RESET session_replication_role;"
                + " ANALYZE products, product_variants");
    }

    private String body(String request) throws Exception {
        return mvc.perform(get(request)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    /** {@code EXPLAIN} of a ranked statement for {@code words}, with the synonyms the service would use. */
    private String plan(List<String> words, Function<SearchSql, String> statement) {
        List<Map.Entry<String, String>> pairs = new ArrayList<>();
        synonyms.findTouching(words).forEach(s -> pairs.add(Map.entry(s.getTermFolded(), s.getSynonymFolded())));
        SearchSql sql = new SearchSql(SearchTerms.of(words, pairs));
        String text = statement.apply(sql);
        String plan = String.join("\n", new NamedParameterJdbcTemplate(jdbc)
                .queryForList("EXPLAIN " + text, sql.params(), String.class));
        log.info("EXPLAIN {}:\n{}", words, plan);
        return plan;
    }

    @Test
    void theCatalogIsLarge() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM products WHERE status = 'APPROVED'", Long.class))
                .isGreaterThan(EXTRA_PRODUCTS);
        // Every API connection sets the threshold of the trigram pre-filter (application.yml).
        assertThat(jdbc.queryForObject("SHOW pg_trgm.word_similarity_threshold", String.class))
                .isEqualTo(SearchSql.PREFILTER_THRESHOLD);
    }

    @Test
    void searchAndSuggestionsReadTheTrigramIndex() {
        for (String plan : List.of(
                plan(List.of("uzuk"), sql -> sql.productPage(24, 0)),
                plan(List.of("uzuk"), SearchSql::productCount),
                plan(List.of("uzu"), sql -> sql.productSuggestions(SearchService.SUGGESTIONS)),
                plan(List.of("qizil", "nisan"), sql -> sql.productPage(24, 0)))) {
            assertThat(plan).contains("Bitmap Index Scan on products_search_text_trgm_idx")
                    .doesNotContain("Seq Scan on products");
        }
    }

    @Test
    void resultsAndTheirOrderDoNotChange() throws Exception {
        assertThat(body("/api/v1/search?q=uzuk&size=96")).isEqualTo(ringsBefore);
        assertThat(body("/api/v1/search/suggest?q=uzu")).isEqualTo(suggestionsBefore);
    }

    @Test
    void savingASynonymEmptiesTheCacheAfterTheCommit() {
        TransactionTemplate tx = new TransactionTemplate(transactions);
        long before = cache.evictions();

        tx.executeWithoutResult(status -> {
            synonyms.save(new SearchSynonym("halqacik", "Üzük"));
            status.setRollbackOnly();
        });
        assertThat(cache.evictions()).as("rolled back: nothing changed").isEqualTo(before);

        SearchSynonym saved = tx.execute(status -> synonyms.save(new SearchSynonym("halqacik", "Üzük")));
        assertThat(cache.evictions()).isGreaterThan(before);
        long afterInsert = cache.evictions();
        tx.executeWithoutResult(status -> synonyms.deleteById(saved.getId()));
        assertThat(cache.evictions()).isGreaterThan(afterInsert);
    }
}
