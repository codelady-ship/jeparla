package az.jeparla.ai.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** The result the seller publishes as a new product photo. */
public record AiApproveRequest(@NotNull @Positive Long assetId) {
}
