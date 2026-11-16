package az.jeparla.verification;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * The pseudonym that replaces a user label ("<name> <email or phone>") in an old declaration and its audit rows
 * (#138): {@code hmac-sha256:<64 hex>} of the label under a secret key. The same label always gives the same
 * pseudonym, so a later court or authority request about a known person can be matched; the label cannot be
 * read back from it without the key.
 */
public final class LabelPseudonym {

    /** The format the database accepts (V56 CHECK and triggers). */
    public static final Pattern FORMAT = Pattern.compile("^hmac-sha256:[0-9a-f]{64}$");
    private static final String PREFIX = "hmac-sha256:";

    private final SecretKeySpec key;

    public LabelPseudonym(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("pseudonym key is empty");
        }
        this.key = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /** The pseudonym of {@code label}; already pseudonymised values are returned unchanged. */
    public String of(String label) {
        if (label == null) {
            throw new IllegalArgumentException("label is null");
        }
        if (FORMAT.matcher(label).matches()) {
            return label;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return PREFIX + HexFormat.of().formatHex(mac.doFinal(label.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
        }
    }
}
