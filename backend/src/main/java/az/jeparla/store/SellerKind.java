package az.jeparla.store;

import az.jeparla.product.MaterialKind;

/**
 * What a store sells (#128): official precious jewelry (gold, silver, platinum, diamonds), bijouterie and
 * handmade jewelry, or both. Only a store that sells precious jewelry goes through the documents check.
 */
public enum SellerKind {
    PRECIOUS,
    FASHION,
    MIXED;

    /** Whether this store may list products of {@code kind}. */
    public boolean allows(MaterialKind kind) {
        return this == MIXED || name().equals(kind.name());
    }

    /** Whether the store sells precious jewelry, so its business documents can be checked (Jeparla Verified). */
    public boolean sellsPrecious() {
        return this != FASHION;
    }
}
