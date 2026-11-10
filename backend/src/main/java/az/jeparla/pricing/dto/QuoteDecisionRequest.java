package az.jeparla.pricing.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Admin decision on a held quote ({@code decisionSchema} in frontend/src/lib/admin/decisions.ts).
 *
 * @param action {@code accept} applies the held quote, {@code discard} throws it away
 * @param reason optional for accept; required (10-500 characters) for discard
 */
@Schema(name = "QuoteDecision")
public record QuoteDecisionRequest(
        @NotNull @Pattern(regexp = "accept|discard") @Schema(allowableValues = {"accept", "discard"}) String action,
        @Size(max = 500) String reason) {
}
