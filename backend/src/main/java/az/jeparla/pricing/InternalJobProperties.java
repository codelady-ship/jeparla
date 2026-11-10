package az.jeparla.pricing;

import java.nio.charset.StandardCharsets;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code jeparla.internal.*}: access to the internal job endpoints (#44).
 *
 * @param jobToken shared secret of {@code POST /internal/jobs/metal-prices}, sent in the
 *                 {@value InternalJobController#TOKEN_HEADER} header ({@code JEPARLA_INTERNAL_JOB_TOKEN},
 *                 32+ bytes, e.g. {@code openssl rand -hex 32}). Empty: the endpoint answers 404.
 */
@ConfigurationProperties("jeparla.internal")
public record InternalJobProperties(String jobToken) {

    static final int MIN_TOKEN_BYTES = 32;

    public InternalJobProperties {
        jobToken = jobToken == null || jobToken.isBlank() ? null : jobToken.strip();
        if (jobToken != null && jobToken.getBytes(StandardCharsets.UTF_8).length < MIN_TOKEN_BYTES) {
            throw new IllegalArgumentException("jeparla.internal.job-token (JEPARLA_INTERNAL_JOB_TOKEN) must be at least "
                    + MIN_TOKEN_BYTES + " bytes");
        }
    }

    public boolean enabled() {
        return jobToken != null;
    }
}
