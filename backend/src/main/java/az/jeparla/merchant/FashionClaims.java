package az.jeparla.merchant;

import az.jeparla.common.i18n.SearchText;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Precious-metal and diamond claims that a FASHION (bijouterie) product must not make in its name or
 * description (#128, #157): "qızıl üzük", "brilyant", "S925", "18 əyar", "925 gümüş", "gold", "altın kolye",
 * "золото" ... The text is folded first ({@link SearchText#fold}: "Qızıl" and "qizil" are the same word,
 * "18-əyar" is "18 eyar"); {@link #find} returns the phrase as the seller wrote it, so the error can name it.
 *
 * <p><b>Metal and stone words</b> in Azerbaijani, Turkish, English and Russian (also in Latin
 * transliteration, "zoloto", "serebro") are matched by their start, so every case ending counts. They are
 * allowed when they only name a colour, a plating or another thing:
 * <ul>
 *   <li>followed by a plating or colour word: "qızıl suyu", "qızıl örtüklü", "gold plated", "silver tone",
 *       "altın kaplama", "золотое покрытие", "Platinum blond";</li>
 *   <li>colour adjectives: Azerbaijani "qızılı", "gümüşü" (as Russian "золотистый", "серебристый"; "qızılı"
 *       is also the accusative of "qızıl", but in a listing it is the colour), English "golden", and
 *       "rose gold" (a colour name in bijouterie; "white gold", "yellow gold" stay claims);</li>
 *   <li>words that only start like a metal: "qızılgül" (rose), "qızıl gül", "qızıl balıq" (goldfish),
 *       "Qızılbaş", "goldfish", English "brilliance".</li>
 * </ul>
 *
 * <p><b>Words that are also names or plain words</b> count only in a material context: "almaz", "elmas"
 * (diamond, but also a woman's name and a collection name: "Almaz xanım kolleksiyası"), English
 * "brilliant" ("Brilliant parıltı") and Turkish "altın" (gold, but Azerbaijani "altın" is "the lower part
 * of": "Kulonun altın hissəsi"). Such a word is a claim when the next word is a piece of jewellery or a
 * stone ("Elmas küpe", "altın yüzük", "almaz daşlı") or a fineness or carat word is at most three words away
 * ("0.5 karat almaz"). Their inflected forms are always claims: "almazlı", "elmaslı", "altınlı", "алмазом".
 *
 * <p><b>Fineness</b> (333 ... 999) is a claim in one word with a metal code or "proba" ("S925", "Ag925",
 * "AU750", "PT950", "925s", "925proba"), and as a separate number next to a metal word ("925 gümüş",
 * "Gümüş 925"), a fineness or karat word ("585 пробы", "585-ci əyar", "proba 585"), a metal code ("Au 585")
 * or a jewellery word ("Üzük 585", "585 sırğa", "кольцо 585"), unless a unit follows it or a size or model
 * label precedes it: "Zəncir uzunluğu 500 mm", "750 ml", "Model 800" pass. A number alone ("Ölçü 17",
 * "Çəki 925 qram") is not a claim. <b>Karats</b> are a
 * claim in one word ("14K", "18kt", "14к", "18ayar") or as a karat number with a karat word ("14 karat",
 * "18 əyar", "24 карата"); "1 carat zirkon" (a stone weight) passes.
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

    /** Whole words that name a metal but whose start is also a common word: Turkish "altınlı". */
    private static final Set<String> CLAIM_WORDS = Set.of("altinli");

    /** Names and plain words that are a claim only in a material context (see the class comment). */
    private static final Set<String> CONTEXTUAL = Set.of(
            "almaz", "almazin", "elmas", "elmasin", "алмаз", "brilliant", "altin");

    /** Colour adjectives and other words that start like a metal. */
    private static final Set<String> NOT_CLAIM_WORDS = Set.of(
            "qizili", "qizilimtil", "qizilimtraq", "gumusu", "gumusumtul", "golden", "goldtone", "silvery",
            "silvertone", "brilliance", "brilliantly");

    /** Word starts that look like a metal but are a colour or another thing. */
    private static final List<String> NOT_CLAIM_PREFIXES = List.of(
            "золотист", "серебрист", "zolotist", "serebrist", "qizilgul", "qizilbas", "qizilbaliq", "qizilagac",
            "qizilqus", "qizilca", "goldfish");

    /** "qızıl" followed by these is a flower or a fish, not gold: "qızıl gül", "qızıl balıq". */
    private static final List<String> QIZIL_NAMES = List.of("gul", "baliq");

    /** A metal word after these is a colour name: "rose gold". */
    private static final Set<String> COLOUR_BEFORE = Set.of("rose", "pink");

    /** A metal word followed by one of these describes a plating or a colour, not the metal itself. */
    private static final Set<String> PLATING = Set.of(
            "suyu", "suyuna", "suyunda", "plated", "plating", "tone", "toned", "color", "colour", "colored",
            "coloured", "rengli", "reng", "ortuk", "ortuklu", "ortuyu", "kaplama", "kaplamali", "покрытие",
            "покрытием", "напыление", "напылением", "цвета", "цвет", "blond", "blonde", "блонд");

    /** Karat numbers. */
    private static final Set<String> KARATS = Set.of("8", "9", "10", "14", "18", "21", "22", "24");

    /** Words after a karat number that make it a claim ("14 karat", "18 əyar"). */
    private static final Set<String> KARAT_WORDS = Set.of(
            "k", "kt", "kr", "karat", "karats", "carat", "carats", "ayar", "eyar", "ayarli", "eyarli", "к",
            "карат", "карата", "каратов");

    /** Fineness numbers. */
    private static final Set<String> FINENESS = Set.of(
            "333", "375", "500", "583", "585", "625", "750", "800", "830", "875", "900", "916", "925", "950", "958",
            "999");

    /** Units right after a fineness number make it a size or an amount: "500 mm", "750 ml". */
    private static final Set<String> UNITS = Set.of(
            "mm", "sm", "cm", "m", "ml", "q", "qr", "qram", "g", "gr", "gram", "mq", "eded", "шт", "мм", "см", "мл",
            "г", "гр", "грамм");

    /** Labels right before a fineness number make it a size or a model: "Model 800", "Uzunluq 500". */
    private static final Set<String> LABELS = Set.of(
            "olcu", "olcusu", "uzunluq", "uzunlugu", "model", "modeli", "размер", "длина", "art", "artikul",
            "артикул", "kod", "kodu", "код");

    /** "Proba" words: "585 пробы", "proba 925". */
    private static final Set<String> PROBA_WORDS = Set.of("proba", "probe", "probu", "пробы", "проба", "пробу", "пр");

    /** Metal codes written apart from the number: "Au 585", "S 925". */
    private static final Set<String> METAL_CODES = Set.of("s", "ag", "au", "pt", "pd");

    /** Ordinal endings written apart from the number by the fold: "585-ci" is "585 ci". */
    private static final Set<String> ORDINALS = Set.of("ci", "cu", "inci", "unci", "nci", "lik", "luk");

    /** Marks a stone weight; with karat and fineness words, the material context of {@link #CONTEXTUAL}. */
    private static final Set<String> CARAT_MARKS = Set.of("ct", "cts");

    /**
     * Starts of jewellery words; such a word after "almaz", "altın" ... makes them a material, and next to a
     * fineness number makes the number a claim ("Üzük 585").
     */
    private static final List<String> JEWELLERY_PREFIXES = List.of(
            "uzuk", "uzuy", "sirga", "bilerzik", "qolbaq", "boyunbag", "kulon", "kolye", "zencir", "bros", "yuzuk",
            "kupe", "bilezik", "gerdanlik", "ring", "earring", "necklace", "bracelet", "pendant", "chain", "кольц",
            "серьг", "колье", "браслет", "кулон", "подвеск", "цеп", "kolc", "braslet");

    /** Whole jewellery words whose start is also a common word: "dəst" (a jewellery set). */
    private static final Set<String> JEWELLERY_WORDS = Set.of("dest", "desti", "destler", "set");

    /** Stone words; such a word after "almaz", "elmas" ... makes them a material ("almaz daşlı"). */
    private static final Set<String> STONES = Set.of(
            "das", "dasi", "dasli", "daslar", "daslari", "tas", "tasi", "tasli", "taslar", "stone", "stones",
            "камень", "камнем", "камни", "kamen", "kamnem", "kamni");

    /**
     * One-word hallmarks: the fineness with a metal code before or after it or "proba" ("S925", "925s",
     * "925proba"), or a karat number with a karat word ("14k", "18ayar").
     */
    private static final Pattern HALLMARK;

    static {
        String fineness = "(?:333|375|500|583|585|625|750|800|830|875|900|916|925|950|958|999)";
        String code = "(?:s|ag|au|pt|pd)";
        String proba = "(?:proba|probe|пробы|проба|пр)";
        HALLMARK = Pattern.compile(code + fineness + code + "?" + proba + "?"
                + "|" + fineness + code + proba + "?"
                + "|" + fineness + proba
                + "|(?:8|9|10|14|18|21|22|24)(?:k|kt|kr|к|karat|carat|ayar|eyar|ayarli|eyarli)");
    }

    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]+");

    private FashionClaims() {
    }

    /** The first forbidden claim in {@code text}, as the seller wrote it ("Qızıl", "585-ci əyar"), or empty. */
    static Optional<String> find(String text) {
        String folded = SearchText.fold(text);
        if (folded.isEmpty()) {
            return Optional.empty();
        }
        String[] words = folded.split(" ");
        for (int i = 0; i < words.length; i++) {
            int[] claim = claimAt(words, i);
            if (claim != null) {
                return Optional.of(original(text, words, claim[0], claim[1]));
            }
        }
        return Optional.empty();
    }

    /** The first and last word of a claim that starts at (or, for "Au 585", just before) word {@code i}. */
    private static int[] claimAt(String[] words, int i) {
        String word = words[i];
        String previous = at(words, i - 1);
        String next = at(words, i + 1);
        if (HALLMARK.matcher(word).matches()) {
            return new int[] {i, i};
        }
        if (KARATS.contains(word) && KARAT_WORDS.contains(next)) {
            return new int[] {i, i + 1};
        }
        if (FINENESS.contains(word)) {
            // A size or a model number: "Zəncir uzunluğu 500 mm", "750 ml", "Model 800".
            if (UNITS.contains(next) || LABELS.contains(previous)) {
                return null;
            }
            int after = ORDINALS.contains(next) ? i + 2 : i + 1;
            // The phrase names a metal or fineness word first ("Au 585 sırğa" -> "Au 585"), else the jewellery.
            if (finenessContext(at(words, after))) {
                return new int[] {i, after};
            }
            if (finenessContext(previous)) {
                return new int[] {i - 1, i};
            }
            if (jewellery(previous)) {
                return new int[] {i - 1, i};
            }
            if (jewellery(at(words, after))) {
                return new int[] {i, after};
            }
            return null;
        }
        if (CONTEXTUAL.contains(word)) {
            boolean material = !PLATING.contains(next) && (jewellery(next) || materialNear(words, i));
            return material ? new int[] {i, i} : null;
        }
        return metal(word, previous, next) ? new int[] {i, i} : null;
    }

    private static boolean metal(String word, String previous, String next) {
        if (NOT_CLAIM_WORDS.contains(word) || NOT_CLAIM_PREFIXES.stream().anyMatch(word::startsWith)) {
            return false;
        }
        if (!CLAIM_WORDS.contains(word) && CLAIM_PREFIXES.stream().noneMatch(word::startsWith)) {
            return false;
        }
        if (PLATING.contains(next) || COLOUR_BEFORE.contains(previous)) {
            return false;
        }
        return !(word.equals("qizil") && QIZIL_NAMES.stream().anyMatch(next::startsWith));
    }

    /** A word that makes a fineness number next to it a claim: a metal, a fineness or karat word, a metal code. */
    private static boolean finenessContext(String word) {
        return !word.isEmpty() && (PROBA_WORDS.contains(word) || METAL_CODES.contains(word)
                || KARAT_WORDS.contains(word) || CLAIM_WORDS.contains(word) || CONTEXTUAL.contains(word)
                || CLAIM_PREFIXES.stream().anyMatch(word::startsWith));
    }

    private static boolean jewellery(String word) {
        return STONES.contains(word) || JEWELLERY_WORDS.contains(word)
                || !word.isEmpty() && JEWELLERY_PREFIXES.stream().anyMatch(word::startsWith);
    }

    /** A karat, carat or "proba" word at most three words before or after word {@code i}. */
    private static boolean materialNear(String[] words, int i) {
        for (int j = Math.max(0, i - 3); j <= Math.min(words.length - 1, i + 3); j++) {
            if (j != i && (KARAT_WORDS.contains(words[j]) || CARAT_MARKS.contains(words[j])
                    || PROBA_WORDS.contains(words[j]))) {
                return true;
            }
        }
        return false;
    }

    private static String at(String[] words, int i) {
        return i >= 0 && i < words.length ? words[i] : "";
    }

    /**
     * Words {@code from} to {@code to} as written in {@code text}, punctuation between them included; the
     * folded words when the original cannot be lined up with them.
     */
    private static String original(String text, String[] words, int from, int to) {
        List<int[]> spans = new ArrayList<>();
        Matcher matcher = WORD.matcher(text);
        while (matcher.find()) {
            spans.add(new int[] {matcher.start(), matcher.end()});
        }
        if (spans.size() != words.length) {
            return String.join(" ", List.of(words).subList(from, to + 1));
        }
        return text.substring(spans.get(from)[0], spans.get(to)[1]);
    }
}
