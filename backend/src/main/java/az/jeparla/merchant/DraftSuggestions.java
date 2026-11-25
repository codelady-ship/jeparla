package az.jeparla.merchant;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Suggestions for a draft from the text of its catalog page (#129): a name, a price in manat and a weight in
 * grams, and the page text itself (cleaned, at most {@value #MAX_TEXT} characters) so the product form can read the
 * category, metal, fineness and description from it. Only suggestions: the seller sees them in the form and confirms or changes them, nothing is published
 * from here. Numbers are {@link BigDecimal} ("4,20" = "4.20").
 */
record DraftSuggestions(String name, BigDecimal price, BigDecimal weight, String text) {

    private static final int MAX_NAME = 120;
    static final int MAX_TEXT = 4000;

    /** "1 250,50 AZN", "990 ₼", "45 manat", "₼ 300", "AZN 1250". */
    private static final Pattern PRICE = Pattern.compile(
            "(\\d{1,3}(?:[ \\u00A0]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?\\s*(?:₼|azn|manat|man\\.)"
                    + "|(?:₼|azn)\\s*(\\d{1,3}(?:[ \\u00A0]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /** "4,2 q", "3.25 gr", "5 g", "4,2 г", "3 qram". */
    private static final Pattern WEIGHT = Pattern.compile(
            "(\\d{1,4})(?:[.,](\\d{1,3}))?\\s*(?:qram|gram|qr|gr|q|g|гр|г)(?![\\p{L}\\p{N}])",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    static DraftSuggestions of(String pageText) {
        if (pageText == null || pageText.isBlank()) {
            return new DraftSuggestions(null, null, null, null);
        }
        return new DraftSuggestions(name(pageText), price(pageText).orElse(null), weight(pageText).orElse(null),
                text(pageText));
    }

    static Optional<BigDecimal> price(String text) {
        Matcher m = PRICE.matcher(text);
        if (!m.find()) {
            return Optional.empty();
        }
        String whole = m.group(1) != null ? m.group(1) : m.group(3);
        String cents = m.group(1) != null ? m.group(2) : m.group(4);
        BigDecimal value = new BigDecimal(whole.replace(" ", "").replace(" ", "")
                + (cents == null ? "" : "." + cents)).setScale(2, RoundingMode.UNNECESSARY);
        return value.signum() > 0 && value.precision() - value.scale() <= 10 ? Optional.of(value) : Optional.empty();
    }

    static Optional<BigDecimal> weight(String text) {
        Matcher m = WEIGHT.matcher(text);
        while (m.find()) {
            BigDecimal value = new BigDecimal(m.group(1) + (m.group(2) == null ? "" : "." + m.group(2)));
            if (value.signum() > 0 && value.compareTo(BigDecimal.valueOf(10_000)) <= 0) {
                return Optional.of(value.setScale(3, RoundingMode.UNNECESSARY));
            }
        }
        return Optional.empty();
    }

    /**
     * The page text as stored: control characters (PostgreSQL refuses NUL) removed, spaces within a line collapsed,
     * blank lines dropped, cut to {@value #MAX_TEXT} characters; null when nothing is left.
     */
    static String text(String pageText) {
        StringBuilder out = new StringBuilder();
        for (String raw : pageText.split("\\R")) {
            String line = raw.replaceAll("\\p{Cntrl}", " ").strip().replaceAll("\\s+", " ");
            if (line.isEmpty()) {
                continue;
            }
            if (out.length() + line.length() + 1 > MAX_TEXT) {
                break;
            }
            out.append(out.isEmpty() ? "" : "\n").append(line);
        }
        return out.isEmpty() ? null : out.toString();
    }

    /** The first line that reads like a name: letters, 3 to 120 characters, no price or weight in it. */
    static String name(String text) {
        for (String raw : text.split("\\R")) {
            String line = raw.strip().replaceAll("\\s+", " ");
            if (line.length() < 3 || line.length() > MAX_NAME || line.chars().noneMatch(Character::isLetter)) {
                continue;
            }
            if (PRICE.matcher(line).find() || WEIGHT.matcher(line).find()) {
                continue;
            }
            return line;
        }
        return null;
    }
}
