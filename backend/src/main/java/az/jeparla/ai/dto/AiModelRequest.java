package az.jeparla.ai.dto;

import az.jeparla.ai.ModelStyle;
import az.jeparla.ai.SkinTone;
import az.jeparla.product.Audience;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Creates or replaces an AI model (ADMIN). {@code audience} is WOMEN, MEN or KIDS; {@code origin} names the tool
 * and date the model was made with. Omitted {@code sortOrder} and {@code active} keep their values on a change
 * (new: 0, active).
 */
public record AiModelRequest(
        @NotBlank @Size(max = 60) String name,
        @NotNull Audience audience,
        @NotNull SkinTone skinTone,
        @NotNull ModelStyle style,
        @NotBlank @Size(max = 300) String origin,
        @Min(0) @Max(10_000) Integer sortOrder,
        Boolean active) {
}
