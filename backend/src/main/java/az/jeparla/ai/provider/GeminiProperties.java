package az.jeparla.ai.provider;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the Gemini image provider ({@code jeparla.ai.image-provider=gemini}, docs/ai-providers.md).
 *
 * @param apiKey          Gemini API key from Google AI Studio ({@code JEPARLA_GEMINI_API_KEY}); empty: not configured.
 *                        Never logged and never printed by {@link #toString()}.
 * @param model           image model, e.g. {@code gemini-2.5-flash-image}
 * @param endpoint        API base URL; {@code /models/{model}:generateContent} is appended
 * @param costPerImage    expected price of one output image, in {@code jeparla.ai.cost-currency}; counted against
 *                        the monthly limit before each call
 * @param timeout         connect and whole-answer timeout of one generateContent call
 * @param downloadTimeout timeout of downloading one input image (product photo, model reference)
 * @param maxInputBytes   size limit of one input image
 * @param maxReferenceImages reference photos of the AI model sent per call; further ones are skipped
 */
@ConfigurationProperties("jeparla.ai.gemini")
public record GeminiProperties(
        @DefaultValue("") String apiKey,
        @DefaultValue("gemini-2.5-flash-image") String model,
        @DefaultValue("https://generativelanguage.googleapis.com/v1beta") String endpoint,
        @DefaultValue("0.039") BigDecimal costPerImage,
        @DefaultValue("120s") Duration timeout,
        @DefaultValue("20s") Duration downloadTimeout,
        @DefaultValue("10485760") int maxInputBytes,
        @DefaultValue("3") int maxReferenceImages) {

    /** Model ids are path segments: letters, digits, dots, dashes and underscores only. */
    static final Pattern MODEL = Pattern.compile("[A-Za-z0-9._-]{1,100}");

    public GeminiProperties {
        apiKey = apiKey == null ? "" : apiKey.strip();
        model = model == null ? "" : model.strip();
        if (!MODEL.matcher(model).matches()) {
            throw new IllegalArgumentException("jeparla.ai.gemini.model must be a model id, e.g. gemini-2.5-flash-image");
        }
        URI uri = URI.create(endpoint == null ? "" : endpoint.strip());
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null) {
            throw new IllegalArgumentException("jeparla.ai.gemini.endpoint must be an absolute http(s) URL");
        }
        endpoint = uri.toString().replaceAll("/+$", "");
        if (costPerImage == null || costPerImage.signum() <= 0) {
            throw new IllegalArgumentException("jeparla.ai.gemini.cost-per-image must be positive");
        }
        if (timeout == null || timeout.isNegative() || timeout.isZero()) {
            throw new IllegalArgumentException("jeparla.ai.gemini.timeout must be positive");
        }
        if (downloadTimeout == null || downloadTimeout.isNegative() || downloadTimeout.isZero()) {
            throw new IllegalArgumentException("jeparla.ai.gemini.download-timeout must be positive");
        }
        if (maxInputBytes < 1024) {
            throw new IllegalArgumentException("jeparla.ai.gemini.max-input-bytes must be at least 1024");
        }
        if (maxReferenceImages < 0 || maxReferenceImages > 10) {
            throw new IllegalArgumentException("jeparla.ai.gemini.max-reference-images must be 0-10");
        }
    }

    /** Whether a key is set. */
    public boolean configured() {
        return !apiKey.isEmpty();
    }

    /** The settings without the key, so they can never reach a log. */
    @Override
    public String toString() {
        return "GeminiProperties[apiKey=" + (configured() ? "(set)" : "(empty)") + ", model=" + model + ", endpoint="
                + endpoint + ", costPerImage=" + costPerImage + ", timeout=" + timeout + ", downloadTimeout="
                + downloadTimeout + ", maxInputBytes=" + maxInputBytes + ", maxReferenceImages=" + maxReferenceImages
                + "]";
    }
}
