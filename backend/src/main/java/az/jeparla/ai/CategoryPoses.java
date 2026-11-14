package az.jeparla.ai;

import az.jeparla.product.Category;
import java.util.Map;

/**
 * Pose of an on-model image (#121) from the product's category: a ring on a hand, earrings at the ear, a necklace
 * on the neck, a bracelet on the wrist; sets and brooches as a half portrait.
 */
final class CategoryPoses {

    private static final Map<String, ModelPose> POSES = Map.of(
            "uzukler", ModelPose.HAND,
            "nisan-uzukleri", ModelPose.HAND,
            "toy-uzukleri", ModelPose.HAND,
            "sirgalar", ModelPose.EAR,
            "boyunbagilar", ModelPose.NECK,
            "zencirler", ModelPose.NECK,
            "asqilar", ModelPose.NECK,
            "qolbaqlar", ModelPose.WRIST,
            "destler", ModelPose.HALF_PORTRAIT,
            "broslar", ModelPose.HALF_PORTRAIT);

    private CategoryPoses() {
    }

    /** The closest category (itself first, then its parents) with a known pose; a half portrait otherwise. */
    static ModelPose of(Category category) {
        for (Category c = category; c != null; c = c.getParent()) {
            ModelPose pose = POSES.get(c.getSlug());
            if (pose != null) {
                return pose;
            }
        }
        return ModelPose.HALF_PORTRAIT;
    }

    /** Words of the pose for the prompt. */
    static String text(ModelPose pose) {
        return switch (pose) {
            case HAND -> "hand and fingers";
            case EAR -> "ear and side of the face";
            case NECK -> "neck and collarbone";
            case WRIST -> "wrist and forearm";
            case HALF_PORTRAIT -> "half portrait, chest up";
        };
    }
}
