package az.jeparla.ai;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Provider-neutral parameters of a job beyond its kind and source photo (filled into the prompt placeholders),
 * and further input images. AI Studio itself (#55) has none; the on-model flow (#121) and the model library
 * (#130) add the audience, pose and model reference photos here.
 */
@Component
public class AiJobParameters {

    /** Prompt parameters of the job, e.g. {@code audience}, {@code pose}; may be empty. */
    public Map<String, String> of(AiJob job) {
        return Map.of();
    }

    /** Public URLs of extra input images (e.g. an AI model's reference photo); may be empty. */
    public List<String> referenceImages(AiJob job) {
        return List.of();
    }
}
