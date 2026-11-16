package az.jeparla.store;

/**
 * A service the store says it offers (#174, V46): the store's own statement, never a Jeparla guarantee.
 * Changed only by the store owner ({@code PUT /api/v1/merchant/store}).
 */
public enum StoreServiceKind {
    RESIZE,
    ENGRAVING,
    GIFT_WRAP,
    DELIVERY,
    RETURNS
}
