package az.jeparla.search.embedding;

import java.awt.image.BufferedImage;
import java.io.IOException;

/** A photo to an L2-normalised embedding (#163); the model behind it is the provider's business. */
public interface ImageEncoder {

    float[] encode(BufferedImage photo) throws IOException;
}
