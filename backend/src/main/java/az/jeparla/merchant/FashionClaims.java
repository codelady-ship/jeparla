package az.jeparla.merchant;

import az.jeparla.common.i18n.SearchText;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Precious-metal and diamond claims that a FASHION (bijouterie) product must not make in its name or
 * description (#128): "qızıl", "brilyant", "585", "gold", "золото" ... The text is folded first
 * ({@link SearchText#fold}: "Qızıl" and "qizil" are the same word).
 *
 * <p>A metal word followed by a plating word is an honest material and allowed: "qızıl suyu", "gümüş
 * suyu", "gold plated", "silver tone"; Russian "позолоченный" and "посеребренный" never match.
 */
final class FashionClaims {

    /** Word starts that name a precious metal or stone. */
    private static final List<String> CLAIM_PREFIXES = List.of(
            "qizil", "gumus", "platin", "brilyant", "brilliant", "almaz", "diamond", "gold", "silver",
            "золот", "серебр", "платин", "бриллиант", "брилл", "алмаз");

    /** Hallmarks (fineness) and karats written as a word. */
    private static final Set<String> HALLMARKS = Set.of(
            "375", "500", "583", "585", "750", "800", "830", "875", "900", "916", "925", "950", "958", "999",
            "9k", "10k", "14k", "18k", "22k", "24k");

    /** A metal word followed by one of these describes a plating or a colour, not the metal itself. */
    private static final Set<String> PLATING = Set.of(
            "suyu", "suyuna", "suyunda", "plated", "plating", "tone", "toned", "color", "colour", "colored",
            "coloured", "rengli", "reng");

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
            if (HALLMARKS.contains(word)) {
                return Optional.of(word);
            }
            boolean metal = CLAIM_PREFIXES.stream().anyMatch(word::startsWith);
            boolean plated = i + 1 < words.length && PLATING.contains(words[i + 1]);
            if (metal && !plated) {
                return Optional.of(word);
            }
        }
        return Optional.empty();
    }
}
