package az.jeparla.store;

import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * Codes of the shareable catalog links {@code /s/<code>} (#100): 8 characters of an alphabet without look-alikes
 * (no 0/o, 1/l), so a code read aloud or typed from a printed QR label is not mistaken. 32^8 (about 10^12) codes:
 * nobody finds stores by counting. PostgreSQL makes the same codes ({@code jeparla_new_share_code()}, V20) for
 * rows inserted by SQL.
 */
public final class ShareCodes {

    public static final int LENGTH = 8;
    static final String ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
    private static final Pattern FORMAT = Pattern.compile("^[a-km-np-z2-9]{" + LENGTH + "}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private ShareCodes() {
    }

    /** A new random code. */
    public static String random() {
        StringBuilder code = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }

    /** Whether {@code code} has the format of a share code (CHECK {@code stores_share_code_format}). */
    public static boolean isValid(String code) {
        return code != null && FORMAT.matcher(code).matches();
    }
}
