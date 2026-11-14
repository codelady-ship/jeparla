package az.jeparla.ai.dto;

import az.jeparla.ai.ModelPose;
import az.jeparla.ai.ModelStyle;
import az.jeparla.ai.SkinTone;
import az.jeparla.product.Audience;
import java.util.List;

/**
 * An AI model of the library (#130). Sellers see active models only.
 *
 * @param origin tool and date the model was made with (as in docs/credits.md)
 * @param poses  the poses its reference photos cover
 */
public record AiModelDto(long id, String name, Audience audience, SkinTone skinTone, ModelStyle style,
        String origin, boolean active, boolean isDefault, int sortOrder, List<ModelPose> poses,
        List<AiModelImageDto> images) {
}
