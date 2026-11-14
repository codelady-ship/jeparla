package az.jeparla.verification.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * The second admin's decision on a suspension request (#138): CONFIRM suspends the store, DISMISS closes the
 * request. {@code note} is internal (audit log only), the seller never sees it.
 */
public record SuspensionDecisionRequest(@NotNull Decision decision, @Size(max = 1000) String note) {

    public enum Decision {
        CONFIRM,
        DISMISS
    }
}
