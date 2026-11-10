package az.jeparla.verification;

/**
 * Admin review of one document. REJECTED and CHANGES_REQUESTED carry a {@link RejectReason}; the seller is told
 * about both (#138) and uploads a new document, the old row stays as evidence.
 */
public enum DocumentStatus {
    PENDING,
    VERIFIED,
    REJECTED,
    /** Not refused as such: the seller is asked for a corrected or another document. */
    CHANGES_REQUESTED
}
