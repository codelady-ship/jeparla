package az.jeparla.store;

import java.time.Duration;
import java.time.Instant;

/**
 * The seller code of conduct and the seller terms (#107). A store accepts both current versions in the /sell
 * wizard and again once a year in the cabinet, and again whenever either version changes; without a valid
 * acceptance no product of the store goes to review. The code text is in the frontend message files
 * ({@code Verified.code}), the terms in {@code frontend/src/content/legal} ({@code sellers}).
 * {@link #CURRENT_VERSION} must exist in {@code seller_code_versions} (V51, V58) and
 * {@link #CURRENT_TERMS_VERSION} in {@code seller_terms_versions} (V58).
 */
public final class SellerCode {

    /** The code version a store has to accept. Raise it together with a new row in seller_code_versions. */
    public static final int CURRENT_VERSION = 2;

    /** The seller terms version a store has to accept. Raise it with a new row in seller_terms_versions. */
    public static final int CURRENT_TERMS_VERSION = 1;

    /** An acceptance is valid for a year, then the seller confirms it again. */
    public static final Duration VALID_FOR = Duration.ofDays(365);

    private SellerCode() {
    }

    /** Whether the store accepted the current code and terms within the last year. */
    public static boolean isAccepted(Store store, Instant now) {
        Instant until = validUntil(store);
        return until != null && until.isAfter(now);
    }

    /** When the acceptance stops being valid, or null when there is no acceptance of the current versions. */
    public static Instant validUntil(Store store) {
        if (!isCurrent(store.getCodeVersion(), CURRENT_VERSION)
                || !isCurrent(store.getTermsVersion(), CURRENT_TERMS_VERSION) || store.getCodeAcceptedAt() == null) {
            return null;
        }
        return store.getCodeAcceptedAt().plus(VALID_FOR);
    }

    private static boolean isCurrent(Integer accepted, int current) {
        return accepted != null && accepted == current;
    }
}
