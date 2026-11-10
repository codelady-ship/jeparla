package az.jeparla.admin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Admin moderation of a product (#40): APPROVE or RETURN an IN_REVIEW product, DEACTIVATE an APPROVED one.
 * RETURN and DEACTIVATE need a reason (10-1000 characters) that the seller sees.
 */
public record ProductDecisionRequest(@NotNull Decision decision, @Size(max = 1000) String reason) {

    public enum Decision {
        APPROVE,
        RETURN,
        DEACTIVATE
    }
}
