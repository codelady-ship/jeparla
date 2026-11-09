package az.jeparla.verification;

/**
 * Status of one Jeparla Verified check (PLAN 5.9): seller, documents, identity of a store and
 * expertise of a product. Each check is separate. Same values as {@code CheckStatus} in
 * frontend/src/types/api.ts.
 */
public enum CheckStatus {
    NONE,
    PENDING,
    VERIFIED,
    REJECTED
}
