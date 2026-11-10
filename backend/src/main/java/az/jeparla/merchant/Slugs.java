package az.jeparla.merchant;

import az.jeparla.common.i18n.SearchText;
import java.security.SecureRandom;
import java.util.Map;

/**
 * URL slugs from names: Azerbaijani letters to Latin ({@link SearchText#fold}), Russian letters
 * transliterated, everything else dropped, words joined with "-" ({@code ^[a-z0-9]+(-[a-z0-9]+)*$}, the
 * CHECK of stores and products).
 */
final class Slugs {

    private static final Map<Character, String> CYRILLIC = Map.ofEntries(
            Map.entry('а', "a"), Map.entry('б', "b"), Map.entry('в', "v"), Map.entry('г', "g"), Map.entry('д', "d"),
            Map.entry('е', "e"), Map.entry('ж', "zh"), Map.entry('з', "z"), Map.entry('и', "i"), Map.entry('й', "y"),
            Map.entry('к', "k"), Map.entry('л', "l"), Map.entry('м', "m"), Map.entry('н', "n"), Map.entry('о', "o"),
            Map.entry('п', "p"), Map.entry('р', "r"), Map.entry('с', "s"), Map.entry('т', "t"), Map.entry('у', "u"),
            Map.entry('ф', "f"), Map.entry('х', "kh"), Map.entry('ц', "ts"), Map.entry('ч', "ch"), Map.entry('ш', "sh"),
            Map.entry('щ', "shch"), Map.entry('ъ', ""), Map.entry('ы', "y"), Map.entry('ь', ""), Map.entry('э', "e"),
            Map.entry('ю', "yu"), Map.entry('я', "ya"));

    private static final String ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Slugs() {
    }

    /** The slug of {@code name}, at most {@code maxLength} characters, or {@code fallback} when nothing is left. */
    static String of(String name, int maxLength, String fallback) {
        StringBuilder out = new StringBuilder();
        for (char c : SearchText.fold(name).toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
                out.append(c);
            } else if (CYRILLIC.containsKey(c)) {
                out.append(CYRILLIC.get(c));
            } else if (c == ' ') {
                out.append('-');
            }
        }
        String slug = out.toString().replaceAll("-+", "-").replaceAll("^-|-$", "");
        if (slug.length() > maxLength) {
            slug = slug.substring(0, maxLength).replaceAll("-+$", "");
        }
        return slug.isEmpty() ? fallback : slug;
    }

    /** {@code base} plus "-" and {@code length} random letters and digits (unique enough without a lookup). */
    static String withSuffix(String base, int length) {
        StringBuilder out = new StringBuilder(base).append('-');
        for (int i = 0; i < length; i++) {
            out.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return out.toString();
    }
}
