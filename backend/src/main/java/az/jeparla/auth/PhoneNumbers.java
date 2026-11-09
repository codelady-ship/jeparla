package az.jeparla.auth;

import java.util.Set;

/**
 * Azerbaijani mobile numbers, normalized to E.164 ({@code +994XXXXXXXXX}). Same rules as
 * {@code frontend/src/lib/seller/schemas.ts} ({@code normalizePhone}).
 */
public final class PhoneNumbers {

    private static final Set<String> MOBILE_CODES = Set.of("10", "50", "51", "55", "60", "70", "77", "99");

    private PhoneNumbers() {
    }

    /**
     * Accepts {@code +994 50 123 45 67}, {@code 994501234567}, {@code 050 123 45 67},
     * {@code 501234567}. Returns null for anything else.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        String local;
        if (digits.startsWith("994")) {
            local = digits.substring(3);
        } else if (digits.startsWith("0")) {
            local = digits.substring(1);
        } else {
            local = digits;
        }
        if (local.length() != 9 || !MOBILE_CODES.contains(local.substring(0, 2))) {
            return null;
        }
        return "+994" + local;
    }
}
