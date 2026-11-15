package az.jeparla.store;

import java.time.Duration;
import java.time.Instant;

/**
 * The seller code of conduct (#107). A store accepts the current version in the /sell wizard and again
 * once a year in the cabinet; without a valid acceptance no product of the store goes to review. The text
 * is in the frontend message files ({@code Verified.code}); {@link #CURRENT_VERSION} must exist in
 * {@code seller_code_versions} (V51).
 */
public final class SellerCode {

    /** The version a store has to accept. Raise it together with a new row in seller_code_versions. */
    public static final int CURRENT_VERSION = 1;

    /** An acceptance is valid for a year, then the seller confirms it again. */
    public static final Duration VALID_FOR = Duration.ofDays(365);

    private SellerCode() {
    }

    /** Whether the store accepted the current version within the last year. */
    public static boolean isAccepted(Store store, Instant now) {
        return store.getCodeVersion() != null && store.getCodeVersion() == CURRENT_VERSION
                && store.getCodeAcceptedAt() != null && store.getCodeAcceptedAt().plus(VALID_FOR).isAfter(now);
    }

    /** When the acceptance stops being valid, or null when there is no acceptance of the current version. */
    public static Instant validUntil(Store store) {
        if (store.getCodeVersion() == null || store.getCodeVersion() != CURRENT_VERSION) {
            return null;
        }
        return store.getCodeAcceptedAt().plus(VALID_FOR);
    }
}
