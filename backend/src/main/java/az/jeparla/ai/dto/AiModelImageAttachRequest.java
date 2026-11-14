package az.jeparla.ai.dto;

import az.jeparla.ai.ModelPose;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Attaches an uploaded reference photo to a model with its pose. */
public record AiModelImageAttachRequest(@NotBlank @Size(max = 200) String key, @NotNull ModelPose pose) {
}
