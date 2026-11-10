package az.jeparla.verification;

/**
 * Why a document was not accepted (docs/legal/sellers-liability.md, section 2c). The seller sees the text of
 * {@code verification.reason.<name>} in their language. AUTHENTICITY is only a reason: suspending an account
 * needs a second person and is not part of this flow (section 3.1).
 */
public enum RejectReason {
    UNREADABLE,
    EXPIRED,
    MISMATCH,
    WRONG_TYPE,
    HALLMARK_MISSING,
    AUTHENTICITY
}
