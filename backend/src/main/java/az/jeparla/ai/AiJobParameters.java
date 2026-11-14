package az.jeparla.ai;

import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.Audience;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Provider-neutral parameters of a job beyond its kind and source photo (filled into the prompt placeholders),
 * and further input images. A VIRTUAL_TRY_ON job with an AI model of the library (#130) passes the model's
 * reference photos, so the same face and proportions come back; the on-model flow (#121) adds the pose.
 * Called by the worker inside its claim transaction.
 */
@Component
public class AiJobParameters {

    private final AiModelCatalog models;
    private final ImageUrls urls;

    public AiJobParameters(AiModelCatalog models, ImageUrls urls) {
        this.models = models;
        this.urls = urls;
    }

    /** Prompt parameters of the job, e.g. {@code audience}; may be empty. */
    public Map<String, String> of(AiJob job) {
        Map<String, String> parameters = new HashMap<>();
        models.forJob(job.getModelId()).ifPresent(model -> {
            parameters.put("audience", audienceText(model.getAudience()));
            parameters.put("model", model.getName());
        });
        return parameters;
    }

    /** Public URLs of the model's reference photos; empty without a model. */
    public List<String> referenceImages(AiJob job) {
        return models.forJob(job.getModelId())
                .map(model -> model.getImages().stream().map(image -> urls.url(image.getStorageKey())).toList())
                .orElse(List.of());
    }

    static String audienceText(Audience audience) {
        return switch (audience) {
            case WOMEN -> "adult woman";
            case MEN -> "adult man";
            case KIDS -> "child (age-appropriate simple clothing, neutral pose and expression)";
            case UNISEX -> "adult woman or man";
        };
    }
}
