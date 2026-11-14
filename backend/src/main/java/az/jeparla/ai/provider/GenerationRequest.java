package az.jeparla.ai.provider;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * What one attempt asks the provider for. No personal data: only the product photo (a public URL), the
 * prompt from the repository (backend/src/main/resources/ai/prompts) and style parameters.
 *
 * @param jobId           the job, for the provider's own idempotency or logs
 * @param kind            what to make, e.g. {@code AI_PHOTOSHOOT}
 * @param sourceImageUrl  public URL of the original product photo
 * @param prompt          the full prompt (preset text with the job's parameters filled in)
 * @param referenceImageUrls further input images, e.g. the reference photos of an AI model (#130); may be empty
 * @param outputs         how many images to return (1-4)
 * @param aspectRatio     e.g. {@code 4:5}
 * @param parameters      extra provider-neutral parameters (audience, pose); may be empty
 */
public record GenerationRequest(long jobId, String kind, String sourceImageUrl, String prompt,
        List<String> referenceImageUrls, int outputs, String aspectRatio, Map<String, String> parameters) {

    public GenerationRequest {
        Objects.requireNonNull(kind);
        Objects.requireNonNull(sourceImageUrl);
        Objects.requireNonNull(prompt);
        referenceImageUrls = List.copyOf(referenceImageUrls);
        parameters = Map.copyOf(parameters);
        if (outputs < 1 || outputs > 4) {
            throw new IllegalArgumentException("outputs must be 1-4");
        }
    }
}
