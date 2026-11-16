package az.jeparla.verification;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Retention of the personal data in seller declarations (#138, docs/legal/analysis.md section 5), bound from
 * {@code jeparla.verification.declarations.*}.
 *
 * @param retentionYears   years after the store's last declaration and the end of its relationship with Jeparla
 *                         before the IP and the user label are pseudonymised; at least 7 (the database function
 *                         refuses less)
 * @param pseudonymKey     HMAC key of the label hash (JEPARLA_PSEUDONYM_KEY), at least 32 characters; empty
 *                         turns the job off (it logs a warning) because a hash without a secret key could be
 *                         reversed by guessing labels
 * @param lockAtMostFor    longest a run may hold its ShedLock lock
 */
@ConfigurationProperties("jeparla.verification.declarations")
public record DeclarationRetentionProperties(
        @DefaultValue("7") int retentionYears,
        @DefaultValue("") String pseudonymKey,
        @DefaultValue("30m") Duration lockAtMostFor) {

    /** The legal floor of the retention period (Criminal Code art. 75.1, analysis.md section 5). */
    public static final int MIN_YEARS = 7;
    static final int MIN_KEY_LENGTH = 32;

    public DeclarationRetentionProperties {
        if (retentionYears < MIN_YEARS || retentionYears > 30) {
            throw new IllegalArgumentException(
                    "jeparla.verification.declarations.retention-years must be between 7 and 30");
        }
        pseudonymKey = pseudonymKey == null ? "" : pseudonymKey.strip();
        if (!pseudonymKey.isEmpty() && pseudonymKey.length() < MIN_KEY_LENGTH) {
            throw new IllegalArgumentException(
                    "jeparla.verification.declarations.pseudonym-key (JEPARLA_PSEUDONYM_KEY) must have at least "
                            + MIN_KEY_LENGTH + " characters");
        }
    }

    /** True when a key is configured and the job may run. */
    public boolean enabled() {
        return !pseudonymKey.isEmpty();
    }

    @Override
    public String toString() {
        // The key never reaches a log line.
        return "DeclarationRetentionProperties[retentionYears=" + retentionYears + ", pseudonymKey="
                + (enabled() ? "<set>" : "<empty>") + ", lockAtMostFor=" + lockAtMostFor + "]";
    }
}
