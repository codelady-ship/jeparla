package az.jeparla.ai.dto;

import az.jeparla.ai.ModelPose;

/** A reference photo of an AI model (public URL). */
public record AiModelImageDto(long id, String url, ModelPose pose, int width, int height) {
}
