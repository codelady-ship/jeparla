package az.jeparla.common.i18n;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Java twin of the SQL function {@code jeparla_fold} (V1) behind the {@code search_text} columns:
 * Azerbaijani letters to Latin ("üzük" -> "uzuk", "Qızıl" -> "qizil"), lower case, and every run of
 * non-letters and non-digits to one space. The frontend uses the same table
 * (frontend/src/lib/search/normalize.ts).
 */
public final class SearchText {

    private static final String FROM = "ƏəİIıŞşÇçĞğÖöÜüЁё";
    private static final String TO = "eeiiissccggoouuее";
    private static final Pattern NON_WORD = Pattern.compile("[^\\p{L}\\p{N}]+");

    private SearchText() {
    }

    public static String fold(String input) {
        if (input == null) {
            return "";
        }
        StringBuilder translated = new StringBuilder(input.length());
        input.codePoints().forEach(cp -> {
            int index = cp <= Character.MAX_VALUE ? FROM.indexOf(cp) : -1;
            translated.append(index >= 0 ? TO.charAt(index) : Character.toString(cp));
        });
        return NON_WORD.matcher(translated.toString().toLowerCase(Locale.ROOT)).replaceAll(" ").strip();
    }

    /** The folded words of a query, at most {@code maxWords}; empty for a blank query. */
    public static List<String> words(String query, int maxWords) {
        String folded = fold(query);
        if (folded.isEmpty()) {
            return List.of();
        }
        return Arrays.stream(folded.split(" ")).distinct().limit(maxWords).toList();
    }

    /** True when every query word is the start of a word of {@code foldedText} (frontend matchesQuery). */
    public static boolean matches(String foldedText, List<String> words) {
        if (words.isEmpty()) {
            return true;
        }
        List<String> textWords = Arrays.asList((foldedText == null ? "" : foldedText).split(" "));
        return words.stream().allMatch(word -> textWords.stream().anyMatch(w -> w.startsWith(word)));
    }
}
