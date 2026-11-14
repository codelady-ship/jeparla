package az.jeparla.ai.dto;

import az.jeparla.ai.AiJobKind;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * A new AI Studio job: what to make from which original photo of the seller's product.
 *
 * @param productId     the seller's product
 * @param sourceImageId one of its photos that is not AI-generated itself
 * @param kind          what to make
 */
public record AiJobRequest(@NotNull @Positive Long productId, @NotNull @Positive Long sourceImageId,
        @NotNull AiJobKind kind) {
}
