package az.jeparla.indexnow;

/**
 * A committed change of a product or store row (#62), as {@link CatalogChangeListener} saw it.
 *
 * @param kind              product or store
 * @param id                its id
 * @param wasPublic         it was public when the transaction loaded it, so its page may have just gone away
 * @param visibilityChanged a store became public or stopped being public: its products' pages changed too
 */
public record CatalogChange(Kind kind, long id, boolean wasPublic, boolean visibilityChanged) {

    public enum Kind {
        PRODUCT,
        STORE
    }

    public static CatalogChange product(long id, boolean wasPublic) {
        return new CatalogChange(Kind.PRODUCT, id, wasPublic, false);
    }

    public static CatalogChange store(long id, boolean wasPublic, boolean visibilityChanged) {
        return new CatalogChange(Kind.STORE, id, wasPublic, visibilityChanged);
    }
}
