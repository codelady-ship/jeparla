package az.jeparla.ai;

import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.Audience;
import az.jeparla.product.Product;
import jakarta.persistence.EntityManager;
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

    /** Parameter with the {@link Audience} name of the job. */
    public static final String AUDIENCE_CODE = "audienceCode";

    private final AiModelCatalog models;
    private final ImageUrls urls;
    private final EntityManager entityManager;

    public AiJobParameters(AiModelCatalog models, ImageUrls urls, EntityManager entityManager) {
        this.models = models;
        this.urls = urls;
        this.entityManager = entityManager;
    }

    /**
     * Prompt parameters of the job: {@code pose} from the product's category and {@code audience} from the product
     * (#121), the chosen model's audience winning; {@link #AUDIENCE_CODE} carries the audience as a code so the
     * prompt of a KIDS piece is the separate child-safe one.
     */
    public Map<String, String> of(AiJob job) {
        Map<String, String> parameters = new HashMap<>();
        Product product = entityManager.find(Product.class, job.getProductId());
        Audience audience = product == null ? Audience.UNISEX : product.getAudience();
        if (product != null) {
            parameters.put("pose", CategoryPoses.text(CategoryPoses.of(product.getCategory())));
        }
        var model = models.forJob(job.getModelId());
        if (model.isPresent()) {
            audience = model.get().getAudience();
            parameters.put("model", model.get().getName());
        }
        parameters.put("audience", audienceText(audience));
        parameters.put(AUDIENCE_CODE, audience.name());
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
