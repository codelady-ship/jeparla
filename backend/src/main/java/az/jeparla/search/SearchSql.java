package az.jeparla.search;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the ranked search statements (#38) over the generated {@code search_text} columns (folded
 * with {@code jeparla_fold}, trigram GIN indexes). Every value is a bound parameter; the SQL text
 * depends only on the number of words and synonyms. Scores are computed and ordered in SQL and never
 * read into Java (they are {@code real}).
 *
 * <p><b>Matching.</b> Every query word must match (AND). A word matches a text when it is a word of
 * the text, starts a word of the text, a synonym of it starts a word of the text, or (3+ letters)
 * its trigram {@code word_similarity} with the text is at least {@value #FUZZY_THRESHOLD}: "uzk"
 * finds "üzük", "кольцо" finds "кольца".
 *
 * <p><b>Ranking</b> (higher first), per word, then averaged over the words:
 * <ul>
 *   <li>1.0 the word is a whole word of the text, 0.8 it starts a word, 0.7 a synonym starts a word,
 *       up to 0.6 typo match (0.6 x similarity), so exact and prefix matches always beat typos;</li>
 *   <li>products: a word in the product name counts fully, in its category name x0.75, in its store
 *       name x0.5 (the mock also finds products by store and category name);</li>
 *   <li>phrase bonus: a store or category name equal to the whole query +1.0, starting with it +0.5
 *       (a store searched by its name comes first); a product name starting with the query +0.3,
 *       containing it as consecutive words +0.2.</li>
 * </ul>
 * Ties: products and stores by id (the catalog order), categories by the admin sort order.
 */
final class SearchSql {

    static final String FUZZY_THRESHOLD = "0.5";

    /** Category ids the public sees: active, under active ancestors only (CategoryTree in SQL). */
    private static final String VISIBLE_CATEGORIES = """
            WITH RECURSIVE visible (id) AS (
                SELECT c.id FROM categories c WHERE c.parent_id IS NULL AND c.active
                UNION ALL
                SELECT c.id FROM categories c JOIN visible v ON c.parent_id = v.id WHERE c.active)
            """;

    /** A listed product (#37): p product, s store. */
    private static final String LISTED_PRODUCT = """
            p.status = 'APPROVED' AND p.deleted_at IS NULL AND p.material_kind = 'PRECIOUS' AND s.status = 'APPROVED'
              AND p.category_id IN (SELECT id FROM visible)
              AND EXISTS (SELECT 1 FROM product_variants lv WHERE lv.product_id = p.id AND lv.deleted_at IS NULL)""";

    private final SearchTerms terms;
    private final Map<String, Object> params = new LinkedHashMap<>();

    SearchSql(SearchTerms terms) {
        this.terms = terms;
    }

    Map<String, Object> params() {
        return params;
    }

    // ------------------------------------------------------------------ statements

    /** {@code [id, total]} of the listed products on one page, best first. */
    String productPage(int limit, long offset) {
        param("limit", limit);
        param("offset", offset);
        return VISIBLE_CATEGORIES + "SELECT x.id, count(*) OVER () FROM (" + scoredProducts("p.id") + ") x"
                + where() + orderBy("x.id") + " LIMIT :limit OFFSET :offset";
    }

    /** Number of matching listed products (for a page after the last one). */
    String productCount() {
        return VISIBLE_CATEGORIES + "SELECT count(*) FROM (" + scoredProducts("p.id") + ") x" + where();
    }

    /** {@code [slug, name_az, name_en, name_ru, price, currency]} of the best products (header suggestions). */
    String productSuggestions(int limit) {
        param("limit", limit);
        return VISIBLE_CATEGORIES + "SELECT x.slug, x.name_az, x.name_en, x.name_ru, d.price, d.currency FROM ("
                + scoredProducts("p.id, p.slug, p.name_az, p.name_en, p.name_ru") + ") x"
                + " JOIN LATERAL (SELECT v.price, v.currency FROM product_variants v"
                + " WHERE v.product_id = x.id AND v.deleted_at IS NULL ORDER BY v.price, v.id LIMIT 1) d ON TRUE"
                + where() + orderBy("x.id") + " LIMIT :limit";
    }

    /** Ids of the best APPROVED stores. */
    String storeIds(int limit) {
        return stores("x.id", limit);
    }

    /** {@code [slug, name, city]} of the best APPROVED stores. */
    String storeSuggestions(int limit) {
        return stores("x.slug, x.name, x.city", limit);
    }

    /** Ids of the best visible categories. */
    String categoryIds(int limit) {
        return categories("x.id", limit);
    }

    /** {@code [slug, name_az, name_en, name_ru]} of the best visible categories. */
    String categorySuggestions(int limit) {
        return categories("x.slug, x.name_az, x.name_en, x.name_ru", limit);
    }

    // ------------------------------------------------------------------ building blocks

    private String stores(String columns, int limit) {
        param("limit", limit);
        StringBuilder sql = new StringBuilder("SELECT ").append(columns)
                .append(" FROM (SELECT s.id, s.slug, s.name, s.city");
        for (int i = 0; i < terms.words().size(); i++) {
            sql.append(", ").append(wordScore(i, "s.search_text")).append(" AS m").append(i);
        }
        sql.append(", ").append(namePhraseBonus(List.of("s.name"))).append(" AS bonus")
                .append(" FROM stores s WHERE s.status = 'APPROVED' OFFSET 0) x")
                .append(where()).append(orderBy("x.id")).append(" LIMIT :limit");
        return sql.toString();
    }

    private String categories(String columns, int limit) {
        param("limit", limit);
        StringBuilder sql = new StringBuilder(VISIBLE_CATEGORIES).append("SELECT ").append(columns)
                .append(" FROM (SELECT c.id, c.slug, c.name_az, c.name_en, c.name_ru, c.sort_order");
        for (int i = 0; i < terms.words().size(); i++) {
            sql.append(", ").append(wordScore(i, "c.search_text")).append(" AS m").append(i);
        }
        sql.append(", ").append(namePhraseBonus(List.of("c.name_az", "c.name_en", "c.name_ru"))).append(" AS bonus")
                .append(" FROM categories c WHERE c.id IN (SELECT id FROM visible) OFFSET 0) x")
                .append(where()).append(orderBy("x.sort_order, x.id")).append(" LIMIT :limit");
        return sql.toString();
    }

    /**
     * Listed products with one score column per word ({@code m0, m1 ...}) and {@code bonus}.
     * {@code OFFSET 0} keeps PostgreSQL from inlining the subquery, so each score is computed once.
     */
    private String scoredProducts(String columns) {
        StringBuilder sql = new StringBuilder("SELECT ").append(columns);
        for (int i = 0; i < terms.words().size(); i++) {
            sql.append(", GREATEST(").append(wordScore(i, "p.search_text"))
                    .append(", 0.75 * ").append(wordScore(i, "c.search_text"))
                    .append(", 0.5 * ").append(wordScore(i, "jeparla_fold(s.name)"))
                    .append(") AS m").append(i);
        }
        sql.append(", ").append(productPhraseBonus()).append(" AS bonus")
                .append(" FROM products p JOIN stores s ON s.id = p.store_id JOIN categories c ON c.id = p.category_id")
                .append(" WHERE ").append(LISTED_PRODUCT).append(" OFFSET 0");
        return sql.toString();
    }

    /** {@code CASE} giving the score of word {@code i} against a folded text, 0 when it does not match. */
    private String wordScore(int i, String text) {
        SearchTerms.Word word = terms.words().get(i);
        String padded = "(' ' || " + text + " || ' ')";
        StringBuilder sql = new StringBuilder("CASE")
                .append(" WHEN ").append(padded).append(" LIKE ").append(param("w" + i + "e", "% " + word.text() + " %"))
                .append(" THEN 1.0")
                .append(" WHEN ").append(padded).append(" LIKE ").append(param("w" + i + "p", "% " + word.text() + "%"))
                .append(" THEN 0.8");
        List<String> synonyms = new ArrayList<>();
        for (int j = 0; j < word.synonyms().size(); j++) {
            synonyms.add(padded + " LIKE " + param("w" + i + "s" + j, "% " + word.synonyms().get(j) + "%"));
        }
        if (!synonyms.isEmpty()) {
            sql.append(" WHEN ").append(String.join(" OR ", synonyms)).append(" THEN 0.7");
        }
        if (word.fuzzy()) {
            String similarity = "word_similarity(" + param("w" + i, word.text()) + ", " + text + ")";
            sql.append(" WHEN ").append(similarity).append(" >= ").append(FUZZY_THRESHOLD)
                    .append(" THEN 0.6 * ").append(similarity);
        }
        return sql.append(" ELSE 0 END").toString();
    }

    /** +1.0 when a name (folded) is the whole query, +0.5 when it starts with it. */
    private String namePhraseBonus(List<String> nameColumns) {
        if (terms.isBlank()) {
            return "0";
        }
        String phrase = param("phrase", terms.phrase());
        String prefix = param("phrasePrefix", terms.phrase() + "%");
        List<String> equal = new ArrayList<>();
        List<String> starts = new ArrayList<>();
        for (String column : nameColumns) {
            equal.add("jeparla_fold(" + column + ") = " + phrase);
            starts.add("jeparla_fold(" + column + ") LIKE " + prefix);
        }
        return "CASE WHEN " + String.join(" OR ", equal) + " THEN 1.0 WHEN " + String.join(" OR ", starts)
                + " THEN 0.5 ELSE 0 END";
    }

    /** +0.3 when the product name starts with the query, +0.2 when it has the query as consecutive words. */
    private String productPhraseBonus() {
        if (terms.isBlank()) {
            return "0";
        }
        String prefix = param("phrasePrefix", terms.phrase() + "%");
        String inside = param("phraseInside", "% " + terms.phrase() + "%");
        return "CASE WHEN p.search_text LIKE " + prefix + " THEN 0.3 WHEN (' ' || p.search_text) LIKE " + inside
                + " THEN 0.2 ELSE 0 END";
    }

    /** Every word matches. */
    private String where() {
        if (terms.isBlank()) {
            return "";
        }
        List<String> conditions = new ArrayList<>();
        for (int i = 0; i < terms.words().size(); i++) {
            conditions.add("x.m" + i + " > 0");
        }
        return " WHERE " + String.join(" AND ", conditions);
    }

    /** Best first (average word score plus the phrase bonus), then {@code ties}; a blank query only by {@code ties}. */
    private String orderBy(String ties) {
        if (terms.isBlank()) {
            return " ORDER BY " + ties;
        }
        List<String> scores = new ArrayList<>();
        for (int i = 0; i < terms.words().size(); i++) {
            scores.add("x.m" + i);
        }
        return " ORDER BY ((" + String.join(" + ", scores) + ") / " + terms.words().size() + " + x.bonus) DESC, "
                + ties;
    }

    private String param(String name, Object value) {
        params.put(name, value);
        return ":" + name;
    }
}
