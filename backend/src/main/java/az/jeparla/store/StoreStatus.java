package az.jeparla.store;

/** Marketplace status of a store, decided by an admin. Only APPROVED stores are public. */
public enum StoreStatus {
    PENDING,
    APPROVED,
    REJECTED,
    BLOCKED
}
