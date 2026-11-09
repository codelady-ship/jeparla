package az.jeparla.common.ratelimit;

import java.time.Duration;

/**
 * Rate-limit policies (PLAN 5.13). Defaults here; {@code jeparla.rate-limit.policies.<id>} overrides
 * them, e.g. {@code jeparla.rate-limit.policies.login-ip.limit=10}.
 */
public enum RateLimitPolicy {

    /** Login attempts from one IP address (password guessing over many accounts). */
    LOGIN_IP("login-ip", 20, Duration.ofMinutes(5)),
    /** Login attempts for one email or phone (guessing one account from many addresses). */
    LOGIN_ACCOUNT("login-account", 10, Duration.ofMinutes(15)),
    /** Sign-ups from one IP address. */
    REGISTER_IP("register-ip", 10, Duration.ofHours(1)),
    /** Sign-up attempts with one email or phone (probing which ones exist). */
    REGISTER_ACCOUNT("register-account", 5, Duration.ofHours(1)),
    /** Token refreshes from one IP address. */
    REFRESH_IP("refresh-ip", 60, Duration.ofMinutes(5)),
    /** Product reports from one IP address (used by the report endpoint, #37). */
    REPORT_IP("report-ip", 10, Duration.ofHours(1)),
    /** Product reports by one account (#37). */
    REPORT_ACCOUNT("report-account", 5, Duration.ofHours(1));

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
