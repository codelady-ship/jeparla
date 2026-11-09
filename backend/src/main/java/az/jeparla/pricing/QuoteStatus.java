package az.jeparla.pricing;

/**
 * APPLIED quotes price products. A quote that moved more than the sanity limit is HELD until an
 * admin applies or discards it (PLAN 5.10).
 */
public enum QuoteStatus {
    APPLIED,
    HELD,
    DISCARDED
}
