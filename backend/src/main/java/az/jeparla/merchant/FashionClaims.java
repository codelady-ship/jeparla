package az.jeparla.merchant;

import az.jeparla.common.i18n.SearchText;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Precious-metal and diamond claims that a FASHION (bijouterie) product must not make in its name or
 * description (#128): "qızıl", "brilyant", "585", "S925", "14 karat", "gold", "altın", "золото" ... The text
 * is folded first ({@link SearchText#fold}: "Qızıl" and "qizil" are the same word, "18-əyar" is "18 eyar").
 *
 * <ul>
 *   <li>Metal and stone words in Azerbaijani, Turkish, English and Russian (also in Latin transliteration,
 *       "zoloto", "serebro") are matched by their start, so every case ending counts.</li>
 *   <li>Fineness written as one word, with an optional metal code before or after it and an optional
 *       "proba": "925", "S925", "Ag925", "AU750", "PT950", "925proba", "925s"; karats as "14K", "18kt",
 *       "14к", "18ayar".</li>
 *   <li>A karat number followed by a karat word: "14 karat", "18 əyar", "22 ayar", "24 карата". Only karat
 *       numbers count, so "1 carat zirkon" (a stone weight) passes.</li>
 * </ul>
 *
 * <p>A metal word followed by a plating word is an honest material and allowed: "qızıl suyu", "qızıl
 * örtüklü", "gümüş suyu", "gold plated", "silver tone", "altın kaplama", "золотое покрытие"; Russian
 * "позолоченный", "посеребренный", "позолота" and the colour words "золотистый", "серебристый" never match.
 */
final class FashionClaims {

    /** Word starts that name a precious metal or stone. */
    private static final List<String> CLAIM_PREFIXES = List.of(
            // Azerbaijani, Turkish
            "qizil", "gumus", "platin", "brilyant", "almaz", "pirlanta", "elmas",
            // English and other Latin spellings
            "brilliant", "brillant", "diamond", "gold", "silver", "sterling",
            // Russian, also in Latin transliteration
            "золот", "серебр", "платин", "бриллиант", "брилл", "алмаз", "zolot", "serebr");

    /**
     * Whole words that name a metal but whose start is also a common word ("altında" is "under it" in
     * Azerbaijani): Turkish "altın" (gold).
     */
    private static final Set<String> CLAIM_WORDS = Set.of("altin", "altinli");

    /** Colour words that start like a metal: "золотистый" (golden-coloured), "серебристый". */
    private static final List<String> COLOUR_PREFIXES = List.of("золотист", "серебрист", "zolotist", "serebrist");

    /** Karat numbers. */
    private static final Set<String> KARATS = Set.of("8", "9", "10", "14", "18", "21", "22", "24");

    /**
     * One-word hallmarks: an optional metal code (S and Ag silver, Au gold, Pt platinum, Pd palladium), the
     * fineness, an optional code after it and an optional "proba"; or a karat number with a karat word.
     */
    private static final Pattern HALLMARK = Pattern.compile(
            "(?:s|ag|au|pt|pd)?(?:375|500|583|585|750|800|830|875|900|916|925|950|958|999)"
                    + "(?:s|ag|au|pt|pd)?(?:proba|probe|пробы|проба|пр)?"
                    + "|(?:8|9|10|14|18|21|22|24)(?:k|kt|kr|к|karat|carat|ayar|eyar|ayarli|eyarli)");

    /** Words after a karat number that make it a claim ("14 karat", "18 əyar"). */
    private static final Set<String> KARAT_WORDS = Set.of(
            "k", "kt", "kr", "karat", "karats", "carat", "carats", "ayar", "eyar", "ayarli", "eyarli", "к",
            "карат", "карата", "каратов");

    /** A metal word followed by one of these describes a plating or a colour, not the metal itself. */
    private static final Set<String> PLATING = Set.of(
            "suyu", "suyuna", "suyunda", "plated", "plating", "tone", "toned", "color", "colour", "colored",
            "coloured", "rengli", "reng", "ortuk", "ortuklu", "ortuyu", "kaplama", "kaplamali", "покрытие",
            "покрытием", "напыление", "напылением", "цвета", "цвет");

    private FashionClaims() {
    }

    /** The first forbidden claim in {@code text}, as written in folded form, or empty. */
    static Optional<String> find(String text) {
        String folded = SearchText.fold(text);
        if (folded.isEmpty()) {
            return Optional.empty();
        }
        String[] words = folded.split(" ");
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            String next = i + 1 < words.length ? words[i + 1] : null;
            if (HALLMARK.matcher(word).matches()) {
                return Optional.of(word);
            }
            if (next != null && KARATS.contains(word) && KARAT_WORDS.contains(next)) {
                return Optional.of(word + " " + next);
            }
            boolean colour = COLOUR_PREFIXES.stream().anyMatch(word::startsWith);
            boolean metal = !colour
                    && (CLAIM_WORDS.contains(word) || CLAIM_PREFIXES.stream().anyMatch(word::startsWith));
            boolean plated = next != null && PLATING.contains(next);
            if (metal && !plated) {
                return Optional.of(word);
            }
        }
        return Optional.empty();
    }
}
