package az.jeparla.ai;

import java.util.Set;

/** QUEUED -> PROCESSING -> REVIEW_REQUIRED -> APPROVED | FAILED | CANCELLED (PLAN 5.12). */
public enum AiJobStatus {
    QUEUED,
    PROCESSING,
    REVIEW_REQUIRED,
    APPROVED,
    FAILED,
    CANCELLED;

    private static final Set<AiJobStatus> FINAL = Set.of(APPROVED, CANCELLED);

    /** No further change: approved (the photo is the product's now) or cancelled. */
    public boolean isFinal() {
        return FINAL.contains(this);
    }
}
