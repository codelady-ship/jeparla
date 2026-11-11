package az.jeparla.search;

import az.jeparla.common.i18n.SearchText;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A search query as SQL sees it: the folded words ({@link SearchText#fold}, the same letters as
 * {@code jeparla_fold} and the frontend), at most {@link #MAX_WORDS}, each with its synonyms.
 *
 * @param words  folded query words in query order, no duplicates; empty for a blank query
 * @param phrase the words joined by one space ("" for a blank query)
 */
record SearchTerms(List<Word> words, String phrase) {

    /** Words of a query that are used; the rest is ignored (the length limit is 100 characters). */
    static final int MAX_WORDS = 8;
    /** Shorter words only match as a word start: a 2-letter typo matches almost everything. */
    static final int MIN_FUZZY_LENGTH = 3;

    /**
     * One query word.
     *
     * @param text        folded word, e.g. "uzuk"
     * @param synonyms    folded synonyms, e.g. "кольцо" (V11 {@code search_synonyms})
     * @param categoryIds categories whose search text the word or a synonym may match ({@link SearchTermsQuery})
     * @param storeIds    stores whose search text the word or a synonym may match
     */
    record Word(String text, List<String> synonyms, List<Long> categoryIds, List<Long> storeIds) {

        /** Typo tolerance (trigram word similarity) for words of 3 and more letters. */
        boolean fuzzy() {
            return text.codePointCount(0, text.length()) >= MIN_FUZZY_LENGTH;
        }
    }

    static List<String> foldedWords(String query) {
        return SearchText.words(query, MAX_WORDS);
    }

    /**
     * @param foldedWords {@link #foldedWords} of the query
     * @param synonymPairs folded {@code [term, synonym]} pairs touching the words, in both directions
     * @param categoryIds  per word index, the categories it may match (missing: none)
     * @param storeIds     per word index, the stores it may match (missing: none)
     */
    static SearchTerms of(List<String> foldedWords, List<Map.Entry<String, String>> synonymPairs,
            Map<Integer, List<Long>> categoryIds, Map<Integer, List<Long>> storeIds) {
        List<Word> words = new ArrayList<>(foldedWords.size());
        for (int i = 0; i < foldedWords.size(); i++) {
            String word = foldedWords.get(i);
            Set<String> synonyms = new LinkedHashSet<>();
            for (Map.Entry<String, String> pair : synonymPairs) {
                if (pair.getKey().equals(word)) {
                    synonyms.add(pair.getValue());
                }
                if (pair.getValue().equals(word)) {
                    synonyms.add(pair.getKey());
                }
            }
            synonyms.remove(word);
            words.add(new Word(word, List.copyOf(synonyms), List.copyOf(categoryIds.getOrDefault(i, List.of())),
                    List.copyOf(storeIds.getOrDefault(i, List.of()))));
        }
        return new SearchTerms(List.copyOf(words), String.join(" ", foldedWords));
    }

    boolean isBlank() {
        return words.isEmpty();
    }
}
