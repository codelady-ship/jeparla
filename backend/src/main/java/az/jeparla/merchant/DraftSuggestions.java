package az.jeparla.merchant;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Suggestions for a draft from the text of its catalog page (#129): a name, a price in manat and a weight in
 * grams, and the page text itself (cleaned, at most {@value #MAX_TEXT} characters) so the product form can read
 * the category, metal, fineness and description from it (frontend {@code lib/merchant/autofill.ts}, same rules
 * for numbers). Only suggestions: the seller sees them in the form and confirms or changes them, nothing is
 * published from here. Numbers are {@link BigDecimal} ("4,20" = "4.20").
 */
record DraftSuggestions(String name, BigDecimal price, BigDecimal weight, String text) {

    private static final int MAX_NAME = 120;
    static final int MAX_TEXT = 4000;
    /** A weight without a label above this is not trusted (a year, a model number). */
    private static final BigDecimal MAX_UNLABELLED_WEIGHT = BigDecimal.valueOf(1000);

    private static final int FLAGS = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;

    /** "1 250" is one number, but "585 450" is a fineness and a price, never 585450. */
    private static final String NUM = "((?!(?:375|583|585|750|875|916|925|950|999)[ \\u00A0]\\d{3}(?!\\d))"
            + "\\d{1,3}(?:[ \\u00A0]\\d{3})+(?!\\d)|\\d+)";

    /** "1 250,50 AZN", "990 ₼", "45 manat", "₼ 300", "AZN 1250". */
    private static final Pattern PRICE = Pattern.compile(
            "(?<![\\d.,])" + NUM + "(?:[.,](\\d{1,2}))?\\s*(?:₼|azn|manat|man\\.|манат)"
                    + "|(?:₼|azn)\\s*" + NUM + "(?:[.,](\\d{1,2}))?",
            FLAGS);

    /** "Qiymət: 450", "Price 450", "Цена: 450" without a currency. */
    private static final Pattern PRICE_LABEL = Pattern.compile(
            "(?:qiymət|qiymet|price|цена|стоимость)\\s*[:\\-]?\\s*" + NUM + "(?:[.,](\\d{1,2}))?(?!\\d)",
            FLAGS);

    /** "4,2 q", "3.25 gr", "5 g", "4,2 г", "3 qram". */
    private static final Pattern WEIGHT = Pattern.compile(
            "(?<![\\d.,])(\\d{1,4})(?:[.,](\\d{1,3}))?\\s*(?:qram|gram|qr|gr|q|g|гр|г)(?![\\p{L}\\p{N}])", FLAGS);

    /** "Çəki: 3,2", "Weight 3.2", "Вес: 3,2": a labelled weight wins over a bare one. */
    private static final Pattern WEIGHT_LABEL = Pattern.compile(
            "(?:çəki|ceki|çeki|weight|вес|масса)\\s*[:\\-]?\\s*(\\d{1,4})(?:[.,](\\d{1,3}))?(?!\\d)", FLAGS);

    /** Azerbaijani phone numbers (+994 50 585 12 34, 055 585 12 34) and other long digit runs. */
    private static final Pattern PHONE = Pattern.compile(
            "(?:\\+\\s?994|(?<![\\d.,])0)[\\s-]?\\(?\\d{2}\\)?[\\s-]?\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{2}(?!\\d)"
                    + "|(?<![\\d.,])\\d{1,4}(?:[\\s-]\\d{2,4}){3,}(?!\\d)");

    /** "2025 г.", "2024 il": a year, not grams. */
    private static final Pattern YEAR = Pattern.compile(
            "(?<![\\d.,])(?:19|20)\\d{2}\\s*(?:г\\.|год|ил|il|year|г)(?![\\p{L}\\p{N}])", FLAGS);

    private static final Pattern HASHTAGS = Pattern.compile("(?:#[\\p{L}\\p{N}_]+[\\s,.]*)+");

    static DraftSuggestions of(String pageText) {
        if (pageText == null || pageText.isBlank()) {
            return new DraftSuggestions(null, null, null, null);
        }
        String numbers = withoutPhonesAndYears(pageText);
        return new DraftSuggestions(name(pageText), price(numbers).orElse(null), weight(numbers).orElse(null),
                text(pageText));
    }

    /** Phone numbers and years are blanked before any number is read. */
    static String withoutPhonesAndYears(String text) {
        return YEAR.matcher(PHONE.matcher(text).replaceAll(" ")).replaceAll(" ");
    }

    static Optional<BigDecimal> price(String text) {
        Matcher m = PRICE.matcher(text);
        if (m.find()) {
            String whole = m.group(1) != null ? m.group(1) : m.group(3);
            String cents = m.group(1) != null ? m.group(2) : m.group(4);
            return money(whole, cents);
        }
        Matcher label = PRICE_LABEL.matcher(text);
        return label.find() ? money(label.group(1), label.group(2)) : Optional.empty();
    }

    private static Optional<BigDecimal> money(String whole, String cents) {
        BigDecimal value = new BigDecimal(whole.replace(" ", "").replace(" ", "")
                + (cents == null ? "" : "." + cents)).setScale(2, RoundingMode.UNNECESSARY);
        return value.signum() > 0 && value.precision() - value.scale() <= 10 ? Optional.of(value) : Optional.empty();
    }

    static Optional<BigDecimal> weight(String text) {
        Matcher label = WEIGHT_LABEL.matcher(text);
        while (label.find()) {
            Optional<BigDecimal> value = grams(label, BigDecimal.valueOf(10_000));
            if (value.isPresent()) {
                return value;
            }
        }
        Matcher m = WEIGHT.matcher(text);
        while (m.find()) {
            Optional<BigDecimal> value = grams(m, MAX_UNLABELLED_WEIGHT);
            if (value.isPresent()) {
                return value;
            }
        }
        return Optional.empty();
    }

    private static Optional<BigDecimal> grams(Matcher m, BigDecimal max) {
        BigDecimal value = new BigDecimal(m.group(1) + (m.group(2) == null ? "" : "." + m.group(2)));
        return value.signum() > 0 && value.compareTo(max) <= 0
                ? Optional.of(value.setScale(3, RoundingMode.UNNECESSARY))
                : Optional.empty();
    }

    /**
     * The page text as stored: control characters (PostgreSQL refuses NUL) removed, spaces within a line collapsed,
     * blank lines dropped, cut to {@value #MAX_TEXT} characters (a longer line is cut, never a surrogate pair);
     * null when nothing is left.
     */
    static String text(String pageText) {
        StringBuilder out = new StringBuilder();
        for (String raw : pageText.split("\\R")) {
            String line = raw.replaceAll("\\p{Cntrl}", " ").strip().replaceAll("\\s+", " ");
            if (line.isEmpty()) {
                continue;
            }
            int room = MAX_TEXT - out.length() - (out.isEmpty() ? 0 : 1);
            if (line.length() > room) {
                int end = room;
                if (end > 0 && Character.isHighSurrogate(line.charAt(end - 1))) {
                    end--;
                }
                String cut = line.substring(0, Math.max(end, 0)).strip();
                if (!cut.isEmpty()) {
                    out.append(out.isEmpty() ? "" : "\n").append(cut);
                }
                break;
            }
            out.append(out.isEmpty() ? "" : "\n").append(line);
        }
        return out.isEmpty() ? null : out.toString();
    }

    /**
     * The first line that reads like a name: letters, 3 to 120 characters, no price or weight (labelled or not),
     * no phone number and not only hashtags.
     */
    static String name(String text) {
        for (String raw : text.split("\\R")) {
            String line = raw.strip().replaceAll("\\s+", " ");
            if (line.length() < 3 || line.length() > MAX_NAME || line.chars().noneMatch(Character::isLetter)) {
                continue;
            }
            if (PRICE.matcher(line).find() || PRICE_LABEL.matcher(line).find() || WEIGHT.matcher(line).find()
                    || WEIGHT_LABEL.matcher(line).find() || PHONE.matcher(line).find()
                    || HASHTAGS.matcher(line).matches()) {
                continue;
            }
            return line;
        }
        return null;
    }
}
