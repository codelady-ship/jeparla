package az.jeparla.ai;

import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.Audience;
import az.jeparla.product.AudienceRules;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The AI model library as sellers use it (#130): only active models with reference photos are offered, and a job
 * may use only such a model. Call inside a transaction.
 */
@Component
public class AiModelCatalog {

    private final AiModelRepository models;
    private final AiModelViews views;

    AiModelCatalog(AiModelRepository models, AiModelViews views) {
        this.models = models;
        this.views = views;
    }

    /** Models a seller can pick, the default of each audience first; {@code audience} null for all. */
    public List<AiModelDto> selectable(Audience audience) {
        return models.findActive(audience).stream().filter(AiModel::isSelectable).map(views::view).toList();
    }

    /**
     * The model of a new job: only VIRTUAL_TRY_ON uses one (400 {@code ai.model_kind} otherwise); a deactivated or
     * empty model is refused (400 {@code ai.model_inactive}), and so is a model of another audience than the
     * product (400 {@code ai.model_mismatch}, #121: a KIDS piece only on a child model). Null stays null.
     */
    public Long checkForJob(AiJobKind kind, Long modelId, Audience productAudience) {
        if (modelId == null) {
            return null;
        }
        if (kind != AiJobKind.VIRTUAL_TRY_ON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.model_kind", "modelId");
        }
        AiModel model = models.findById(modelId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "ai.model_inactive", "modelId"));
        if (!model.isSelectable()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.model_inactive", "modelId");
        }
        if (!AudienceRules.fits(productAudience, model.getAudience())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.model_mismatch", "modelId");
        }
        return model.getId();
    }

    /** The model of a job for the worker, while it is still offered. */
    Optional<AiModel> forJob(Long modelId) {
        return modelId == null ? Optional.empty() : models.findById(modelId).filter(AiModel::isSelectable);
    }
}
