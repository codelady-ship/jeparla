package az.jeparla.ai;

import az.jeparla.ai.provider.ImageGenerationException;
import java.util.Set;

/** Failure codes stored on a job ({@code ai_jobs.error_code}); each has a message in the three languages. */
final class ImageGenerationCodes {

    /** The monthly hard cost limit was reached before the attempt; the attempt did not run. */
    static final String COST_LIMIT = "ai.cost_limit";
    /** The result was not a JPEG, PNG or WebP of a usable size. */
    static final String BAD_RESULT = "ai.bad_result";
    /** The source photo was removed before the job ran. */
    static final String SOURCE_GONE = "ai.source_gone";

    /** Every code a job may carry. */
    static final Set<String> ALL = Set.of(ImageGenerationException.NOT_CONFIGURED,
            ImageGenerationException.PROVIDER_ERROR, ImageGenerationException.REFUSED, ImageGenerationException.TIMEOUT,
            COST_LIMIT, BAD_RESULT, SOURCE_GONE);

    /** A retry cannot help: the input is gone or the provider's policy refused it. */
    static final Set<String> NOT_RETRYABLE = Set.of(ImageGenerationException.REFUSED, SOURCE_GONE);

    private ImageGenerationCodes() {
    }

    /** A provider code outside the known set is stored as {@code ai.provider_error}. */
    static String known(String code) {
        return code != null && ALL.contains(code) ? code : ImageGenerationException.PROVIDER_ERROR;
    }
}
