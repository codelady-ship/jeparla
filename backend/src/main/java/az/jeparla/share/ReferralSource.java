package az.jeparla.share;

import java.util.Locale;
import java.util.Map;

/**
 * Where a visitor of a shared store link came from (#100): the {@code ref} or {@code utm_source} parameter of the
 * link, folded into a short fixed list so the merchant's statistics stay readable and nobody can fill the table
 * with made-up values. CHECK {@code store_referral_counts_source} (V20) lists the same names.
 */
public enum ReferralSource {
    INSTAGRAM,
    TIKTOK,
    WHATSAPP,
    TAPAZ,
    FACEBOOK,
    TELEGRAM,
    YOUTUBE,
    /** The printed or downloaded QR code (its URL carries {@code ref=qr}). */
    QR,
    /** The share link {@code /s/<code>} without a source of its own. */
    LINK,
    /** Any other value. */
    OTHER;

    /** Longest parameter value looked at; a longer one is OTHER. */
    static final int MAX_LENGTH = 64;

    private static final Map<String, ReferralSource> ALIASES = Map.ofEntries(
            Map.entry("instagram", INSTAGRAM), Map.entry("ig", INSTAGRAM), Map.entry("insta", INSTAGRAM),
            Map.entry("tiktok", TIKTOK), Map.entry("tt", TIKTOK),
            Map.entry("whatsapp", WHATSAPP), Map.entry("wa", WHATSAPP),
            Map.entry("tapaz", TAPAZ), Map.entry("tap.az", TAPAZ), Map.entry("tap", TAPAZ),
            Map.entry("facebook", FACEBOOK), Map.entry("fb", FACEBOOK),
            Map.entry("telegram", TELEGRAM), Map.entry("tg", TELEGRAM),
            Map.entry("youtube", YOUTUBE), Map.entry("yt", YOUTUBE),
            Map.entry("qr", QR),
            Map.entry("link", LINK), Map.entry("share", LINK));

    /**
     * The source of a link: {@code ref} wins over {@code utm_source}. Case and surrounding spaces do not matter,
     * and {@code ref=Instagram_Bio} is still INSTAGRAM (the part before the first {@code _}, {@code -} or space).
     *
     * @return the source, or null when neither parameter has a value (then nothing is counted)
     */
    public static ReferralSource parse(String ref, String utmSource) {
        String value = ref != null && !ref.isBlank() ? ref : utmSource;
        if (value == null || value.isBlank()) {
            return null;
        }
        String folded = value.strip().toLowerCase(Locale.ROOT);
        if (folded.length() > MAX_LENGTH) {
            return OTHER;
        }
        ReferralSource exact = ALIASES.get(folded);
        if (exact != null) {
            return exact;
        }
        String head = folded.split("[_\\-\\s]", 2)[0];
        return ALIASES.getOrDefault(head, OTHER);
    }
}
