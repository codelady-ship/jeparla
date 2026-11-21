package az.jeparla.ai.studio;

import java.awt.image.BufferedImage;

/** Finds the item in a photo (#119): a soft mask, 0 for background and 1 for the item, one value per pixel. */
public interface Segmenter {

    /**
     * Mask of {@code image}, row by row ({@code width * height} values in 0..1).
     *
     * @throws java.io.IOException when the model cannot run
     */
    float[] mask(BufferedImage image) throws java.io.IOException;
}
