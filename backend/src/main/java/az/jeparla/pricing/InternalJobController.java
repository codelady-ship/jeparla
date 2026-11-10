package az.jeparla.pricing;

import az.jeparla.common.error.ApiException;
import az.jeparla.pricing.MetalPriceJob.Report;
import az.jeparla.pricing.MetalPriceJob.Trigger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code POST /internal/jobs/metal-prices} (#44): runs the metal price job now, for the stale-price
 * check (.github/workflows/metal-prices-check.yml) and by hand. Protected by a shared secret in the
 * {@value #TOKEN_HEADER} header, not by a user token (the workflow has no account); 404 while
 * {@code JEPARLA_INTERNAL_JOB_TOKEN} is not set. Idempotent and under the same lock as the cron run.
 * Not part of the public OpenAPI document (only {@code /api/**} is).
 */
@RestController
public class InternalJobController {

    public static final String TOKEN_HEADER = "X-Jeparla-Job-Token";

    private static final Logger log = LoggerFactory.getLogger(InternalJobController.class);

    private final InternalJobProperties properties;
    private final MetalPriceJob job;

    public InternalJobController(InternalJobProperties properties, MetalPriceJob job) {
        this.properties = properties;
        this.job = job;
    }

    @PostMapping("/internal/jobs/metal-prices")
    public Report runMetalPrices(@RequestHeader(name = TOKEN_HEADER, required = false) String token) {
        if (!properties.enabled()) {
            throw ApiException.notFound();
        }
        if (token == null || !MessageDigest.isEqual(properties.jobToken().getBytes(StandardCharsets.UTF_8),
                token.strip().getBytes(StandardCharsets.UTF_8))) {
            log.warn("Internal metal price job call with a wrong token refused");
            throw new ApiException(HttpStatus.UNAUTHORIZED, "jobs.invalid_token");
        }
        return job.runLocked(Trigger.INTERNAL)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "jobs.already_running"));
    }
}
