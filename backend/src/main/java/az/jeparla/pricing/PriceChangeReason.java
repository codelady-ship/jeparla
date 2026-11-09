package az.jeparla.pricing;

/** Why a variant price changed: edited by the seller, repriced from a new quote, or set by an admin. */
public enum PriceChangeReason {
    MERCHANT,
    METAL_PRICE,
    ADMIN
}
