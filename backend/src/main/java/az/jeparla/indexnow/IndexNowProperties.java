package az.jeparla.indexnow;

import java.net.URI;
import java.time.Duration;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * IndexNow settings (#62).
 *
 * @param key      the site's IndexNow key ({@code JEPARLA_INDEXNOW_KEY}): 8 to 128 letters, digits or dashes, the
 *                 same value the frontend serves at {@code /<key>.txt}. Empty: IndexNow is off.
 * @param endpoint submission URL; {@code api.indexnow.org} shares every submission with all IndexNow engines
 * @param delay    how long a changed URL waits before it is sent, so the site's page cache (catalog: 5 minutes)
 *                 already shows the change when an engine comes to crawl it; also the wait before a retry
 * @param attempts submissions of a URL before it is given up (network errors, 429 and 5xx only)
 * @param timeout  connect and response timeout of one submission
 */
@ConfigurationProperties("jeparla.indexnow")
public record IndexNowProperties(
        @DefaultValue("") String key,
        @DefaultValue("https://api.indexnow.org/indexnow") String endpoint,
        @DefaultValue("10m") Duration delay,
        @DefaultValue("5") int attempts,
        @DefaultValue("10s") Duration timeout) {

    /** IndexNow key format (indexnow.org documentation). */
    static final Pattern KEY = Pattern.compile("[A-Za-z0-9-]{8,128}");

    public IndexNowProperties {
        key = key == null ? "" : key.strip();
        if (!key.isEmpty() && !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("jeparla.indexnow.key must be 8-128 letters, digits or dashes");
        }
        URI uri = URI.create(endpoint == null ? "" : endpoint.strip());
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null) {
            throw new IllegalArgumentException("jeparla.indexnow.endpoint must be an absolute http(s) URL");
        }
        endpoint = uri.toString();
        if (delay == null || delay.isNegative()) {
            throw new IllegalArgumentException("jeparla.indexnow.delay must not be negative");
        }
        if (attempts < 1) {
            throw new IllegalArgumentException("jeparla.indexnow.attempts must be at least 1");
        }
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalArgumentException("jeparla.indexnow.timeout must be positive");
        }
    }

    /** Whether submissions are on (a key is set). */
    public boolean enabled() {
        return !key.isEmpty();
    }
}
