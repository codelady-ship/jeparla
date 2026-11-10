package az.jeparla.pricing.dto;

import az.jeparla.pricing.QuoteStatus;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Result of an admin decision on a held quote.
 *
 * @param repricing {@code DONE} when the variants were repriced at once, {@code DEFERRED} when another
 *                  run held the lock (the next scheduled run reprices them), {@code NONE} for a discard
 */
@Schema(name = "QuoteDecisionResult", requiredProperties = {"metal", "status", "note", "repricing"})
public record QuoteDecisionDto(Metal metal, QuoteStatus status, @Schema(nullable = true) String note,
        @Schema(allowableValues = {"DONE", "DEFERRED", "NONE"}) String repricing) {
}
