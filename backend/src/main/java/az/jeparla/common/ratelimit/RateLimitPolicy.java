package az.jeparla.common.ratelimit;

import java.time.Duration;

/**
 * Rate-limit policies (PLAN 5.13). Defaults here; {@code jeparla.rate-limit.policies.<id>} overrides
 * them, e.g. {@code jeparla.rate-limit.policies.login-ip.limit=10}.
 */
public enum RateLimitPolicy {

    /** Login attempts from one IP address (password guessing over many accounts). */
    LOGIN_IP("login-ip", 20, Duration.ofMinutes(5)),
    /**
     * Failed logins for one email or phone from one IP address (guessing one account). Over the
     * limit that address gets 429 for this account before the password is checked; a successful
     * login clears it. Other addresses, including the owner's, are not affected.
     */
    LOGIN_ACCOUNT_IP("login-account-ip", 5, Duration.ofMinutes(15)),
    /**
     * Failed logins for one email or phone from all addresses (distributed guessing). Only failures
     * count, so nobody can lock an account by sending requests. Over the limit the account is under
     * attack: it can still sign in from a {@link #LOGIN_KNOWN_ADDRESS known address}, any other
     * address gets 429 before the password is checked until the window ends.
     */
    LOGIN_ACCOUNT("login-account", 50, Duration.ofHours(1)),
    /**
     * Addresses an account signed in from successfully (marker per account and address, the limit
     * is unused). They keep working while the account is under attack ({@link #LOGIN_ACCOUNT}).
     */
    LOGIN_KNOWN_ADDRESS("login-known-address", 1, Duration.ofDays(30)),
    /** Sign-ups from one IP address. */
    REGISTER_IP("register-ip", 10, Duration.ofHours(1)),
    /** Sign-up attempts with one email or phone (probing which ones exist). */
    REGISTER_ACCOUNT("register-account", 5, Duration.ofHours(1)),
    /** "Forgot password" requests from one IP address (#131). */
    PASSWORD_FORGOT_IP("password-forgot-ip", 10, Duration.ofHours(1)),
    /**
     * "Forgot password" requests for one email address (#131), whether the account exists or not. Over the limit
     * the answer stays the same 202, but no email is written: a stranger cannot flood someone's inbox.
     */
    PASSWORD_FORGOT_ACCOUNT("password-forgot-account", 3, Duration.ofHours(1)),
    /** New passwords set with a reset link from one IP address (#131); the token itself is 256 random bits. */
    PASSWORD_RESET_IP("password-reset-ip", 20, Duration.ofHours(1)),
    /** Email verification links opened from one IP address (#131). */
    EMAIL_VERIFY_IP("email-verify-ip", 30, Duration.ofHours(1)),
    /** Verification emails one signed-in account asks to be sent again (#131). */
    EMAIL_VERIFICATION_ACCOUNT("email-verification-account", 3, Duration.ofHours(1)),
    /** Token refreshes from one IP address. */
    REFRESH_IP("refresh-ip", 60, Duration.ofMinutes(5)),
    /** Product reports from one IP address (used by the report endpoint, #37). */
    REPORT_IP("report-ip", 10, Duration.ofHours(1)),
    /** Product reports by one account (#37). */
    REPORT_ACCOUNT("report-account", 5, Duration.ofHours(1)),
    /**
     * WhatsApp contact clicks counted from one IP address (#37). Clicks over the limit are not counted
     * (no error), so the statistics cannot be inflated by a script.
     */
    CONTACT_IP("contact-ip", 60, Duration.ofHours(1)),
    /**
     * Searches and suggestions from one IP address (#38, PLAN 5.13): generous for people typing in
     * the header box (also behind a shared mobile carrier address), but a script cannot run ranked
     * queries without limit. CDN hits never reach the API, so they are not counted.
     */
    SEARCH_IP("search-ip", 300, Duration.ofMinutes(1)),
    /**
     * Presigned photo uploads asked for by one seller account (#154): every presign lets the browser
     * write up to 15 MB, so a script cannot fill the storage. The 8-photo limit per product and the
     * daily limit per store apply as well.
     */
    IMAGE_UPLOAD_ACCOUNT("image-upload-account", 60, Duration.ofHours(1)),
    /**
     * Product spreadsheet imports by one seller account (#109): each creates up to 200 DRAFT products, so a day
     * allows a few thousand, more than any seller moving a catalog needs, and a script cannot fill the database.
     */
    PRODUCT_IMPORT_ACCOUNT("product-import-account", 20, Duration.ofDays(1)),
    /**
     * Presigned verification document uploads asked for by one seller account (#40): each lets the browser write
     * up to 10 MB into the private bucket. The open and daily limits per store apply as well.
     */
    DOCUMENT_UPLOAD_ACCOUNT("document-upload-account", 20, Duration.ofHours(1));

    private final String id;
    private final int defaultLimit;
    private final Duration defaultWindow;

    RateLimitPolicy(String id, int defaultLimit, Duration defaultWindow) {
        this.id = id;
        this.defaultLimit = defaultLimit;
        this.defaultWindow = defaultWindow;
    }

    /** Configuration key and Redis key prefix. */
    public String id() {
        return id;
    }

    public int defaultLimit() {
        return defaultLimit;
    }

    public Duration defaultWindow() {
        return defaultWindow;
    }
}
