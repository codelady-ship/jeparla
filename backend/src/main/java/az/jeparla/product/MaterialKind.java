package az.jeparla.product;

/**
 * What a product is made of (#128). PRECIOUS: a precious metal with a fineness and a weight, optionally
 * priced from the daily metal quote. FASHION: bijouterie or handmade jewelry, no metal and no fineness, a
 * {@link FashionMaterial} instead, FIXED prices only and no certificates.
 */
public enum MaterialKind {
    PRECIOUS,
    FASHION
}
