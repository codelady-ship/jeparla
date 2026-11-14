package az.jeparla.product;

/**
 * Category-based defaults of an on-model image (#121). The seller may always change the suggested audience.
 */
public final class AudienceRules {

    static final String MEN_ROOT = "kisi-zergerliyi";
    static final String KIDS_ROOT = "usaq-zergerliyi";

    private AudienceRules() {
    }

    /** MEN or KIDS below those root categories, otherwise UNISEX (the seller narrows it to WOMEN if needed). */
    public static Audience suggest(Category category) {
        Category root = category;
        while (root != null && root.getParent() != null) {
            root = root.getParent();
        }
        if (root == null) {
            return Audience.UNISEX;
        }
        return switch (root.getSlug()) {
            case MEN_ROOT -> Audience.MEN;
            case KIDS_ROOT -> Audience.KIDS;
            default -> Audience.UNISEX;
        };
    }

    /**
     * Whether an AI model of {@code model} audience may wear a piece for {@code product}: a KIDS piece only on a
     * child model and a child model only with a KIDS piece; a UNISEX piece on any adult model.
     */
    public static boolean fits(Audience product, Audience model) {
        if (product == Audience.KIDS || model == Audience.KIDS) {
            return product == model;
        }
        return product == Audience.UNISEX || product == model;
    }
}
