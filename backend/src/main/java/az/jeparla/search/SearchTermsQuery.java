package az.jeparla.search;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The first statement of a search (#151): the synonyms touching the query words and, per word, the ids of the
 * categories and stores whose search text the word or one of its synonyms may match (the same pre-filter as
 * {@link SearchSql}). The ranked statements then find products by their category and store through literal id
 * lists, which the planner estimates from the product statistics (an {@code = ANY(ARRAY(subquery))} has no
 * estimate, so the planner assumed most products match and scanned all of them). One statement, like the
 * synonym lookup it replaces: categories and stores are small tables with trigram indexes.
 */
final class SearchTermsQuery {

    private final List<String> words;
    private final Map<String, Object> params = new LinkedHashMap<>();

    /** @param words {@link SearchTerms#foldedWords} of a query, not empty */
    SearchTermsQuery(List<String> words) {
        if (words.isEmpty()) {
            throw new IllegalArgumentException("a blank query has no terms to look up");
        }
        this.words = List.copyOf(words);
    }

    Map<String, Object> params() {
        return params;
    }

    /** Rows {@code [kind, word index, term, synonym, id]}: kind S (synonym pair), C (category) or T (store). */
    String sql() {
        params.put("words", words);
        StringBuilder sql = new StringBuilder(
                "SELECT CAST('S' AS text) AS kind, -1 AS word, s.term_folded AS term, s.synonym_folded AS synonym,"
                        + " CAST(NULL AS bigint) AS id FROM search_synonyms s"
                        + " WHERE s.term_folded IN (:words) OR s.synonym_folded IN (:words)");
        for (int i = 0; i < words.size(); i++) {
            sql.append(" UNION ALL SELECT 'C', ").append(i).append(", NULL, NULL, c.id FROM categories c WHERE ")
                    .append(matches(i, "c.search_text"))
                    .append(" UNION ALL SELECT 'T', ").append(i).append(", NULL, NULL, st.id FROM stores st WHERE ")
                    .append(matches(i, "st.search_text"));
        }
        return sql.toString();
    }

    /** The terms from the rows of {@link #sql()}. */
    SearchTerms read(List<Object[]> rows) {
        List<Map.Entry<String, String>> pairs = new ArrayList<>();
        Map<Integer, List<Long>> categories = new HashMap<>();
        Map<Integer, List<Long>> stores = new HashMap<>();
        for (Object[] row : rows) {
            String kind = row[0].toString().strip();
            int word = ((Number) row[1]).intValue();
            switch (kind) {
                case "S" -> pairs.add(Map.entry((String) row[2], (String) row[3]));
                case "C" -> categories.computeIfAbsent(word, w -> new ArrayList<>()).add(((Number) row[4]).longValue());
                case "T" -> stores.computeIfAbsent(word, w -> new ArrayList<>()).add(((Number) row[4]).longValue());
                default -> throw new IllegalStateException("unknown row kind " + kind);
            }
        }
        categories.values().forEach(ids -> ids.sort(null));
        stores.values().forEach(ids -> ids.sort(null));
        return SearchTerms.of(words, pairs, categories, stores);
    }

    /**
     * Word {@code i} or one of its synonyms starts the text or a word of it, or (3+ letters) the trigram word
     * similarity reaches {@value SearchSql#PREFILTER_THRESHOLD}: what {@code SearchSql.wordFilter} accepts.
     */
    private String matches(int i, String text) {
        String word = words.get(i);
        String t = ":t" + i;
        params.put("t" + i, word);
        params.put("t" + i + "b", word + "%");
        params.put("t" + i + "p", "% " + word + "%");
        StringBuilder sql = new StringBuilder("(").append(text).append(" LIKE ").append(t).append("b OR ")
                .append(text).append(" LIKE ").append(t).append("p");
        if (word.codePointCount(0, word.length()) >= SearchTerms.MIN_FUZZY_LENGTH) {
            sql.append(" OR ").append(text).append(" %> ").append(t);
        }
        sql.append(" OR EXISTS (SELECT 1 FROM search_synonyms ss CROSS JOIN LATERAL (SELECT CASE WHEN ss.term_folded = ")
                .append(t).append(" THEN ss.synonym_folded ELSE ss.term_folded END AS other) o")
                .append(" WHERE (ss.term_folded = ").append(t).append(" OR ss.synonym_folded = ").append(t).append(")")
                .append(" AND (").append(text).append(" LIKE o.other || '%' OR ").append(text)
                .append(" LIKE '% ' || o.other || '%')))");
        return sql.toString();
    }
}
