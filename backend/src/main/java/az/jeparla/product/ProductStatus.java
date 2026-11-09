package az.jeparla.product;

/**
 * Product lifecycle (PLAN 5.9): DRAFT -> IN_REVIEW -> APPROVED | RETURNED. INACTIVE replaces
 * deleting; a "deleted" product is INACTIVE with {@code deleted_at} set. Only APPROVED and not
 * deleted products are public.
 */
public enum ProductStatus {
    DRAFT,
    IN_REVIEW,
    APPROVED,
    RETURNED,
    INACTIVE
}
