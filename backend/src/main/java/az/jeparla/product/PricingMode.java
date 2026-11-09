package az.jeparla.product;

/**
 * Variant pricing (PLAN 5.10). FIXED: the seller's price. METAL_LINKED: recomputed from the
 * daily CBAR quote, labor, stone price and markup (#44).
 */
public enum PricingMode {
    FIXED,
    METAL_LINKED
}
