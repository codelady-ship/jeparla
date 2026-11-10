package az.jeparla.verification.dto;

import az.jeparla.verification.RejectReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * An admin decision on a document (#40, #138): APPROVE, REJECT or REQUEST_CHANGES. A refusal needs a
 * {@code reason} category; {@code note} is optional free text the seller sees with it (no personal data).
 */
public record DocumentDecisionRequest(
        @NotNull Decision decision,
        RejectReason reason,
        @Size(max = 1000) String note) {

    public enum Decision {
        APPROVE,
        REJECT,
        REQUEST_CHANGES
    }
}
