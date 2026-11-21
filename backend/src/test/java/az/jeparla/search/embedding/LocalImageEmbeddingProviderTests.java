package az.jeparla.search.embedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/** The local embedding provider (#163) with a stand-in encoder: CI never downloads the model. */
class LocalImageEmbeddingProviderTests {

    /** Mean colour as a 3-value vector: enough to tell the provider passes the decoded photo on. */
    private static final ImageEncoder MEAN_COLOUR = photo -> {
        float r = 0;
        float g = 0;
        float b = 0;
        for (int y = 0; y < photo.getHeight(); y++) {
            for (int x = 0; x < photo.getWidth(); x++) {
                int p = photo.getRGB(x, y);
                r += (p >> 16) & 0xFF;
                g += (p >> 8) & 0xFF;
                b += p & 0xFF;
            }
        }
        return new float[] {r, g, b};
    };

    private static byte[] png(Color colour) throws IOException {
        BufferedImage image = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(colour);
        g.fillRect(0, 0, 32, 32);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    @Test
    void notConfiguredUntilTheModelIsLoaded() throws IOException {
        LocalImageEmbeddingProvider provider = new LocalImageEmbeddingProvider(true, () -> MEAN_COLOUR);
        assertThat(provider.configured()).isFalse();
        assertThatThrownBy(() -> provider.embed(png(Color.RED), "image/png"))
                .isInstanceOf(ImageEmbeddingException.class);

        assertThat(provider.prepare()).isTrue();

        assertThat(provider.configured()).isTrue();
        float[] red = provider.embed(png(Color.RED), "image/png");
        assertThat(red[0]).isGreaterThan(red[2]);
    }

    @Test
    void theModelNameCarriesThePinnedHash() {
        LocalImageEmbeddingProvider provider = new LocalImageEmbeddingProvider(false, () -> MEAN_COLOUR);
        assertThat(provider.id()).isEqualTo("local");
        assertThat(provider.model()).isEqualTo("dinov2-small@" + LocalImageEmbeddingProvider.MODEL.sha256()
                .substring(0, 12));
        assertThat(provider.minSimilarity()).isBetween(0.2, 0.3);
    }

    @Test
    void notSelectedMeansNoDownloadAndAFailedLoadStaysOff() {
        LocalImageEmbeddingProvider off = new LocalImageEmbeddingProvider(false, () -> {
            throw new AssertionError("must not load");
        });
        off.prepareInBackground();
        assertThat(off.configured()).isFalse();

        LocalImageEmbeddingProvider broken = new LocalImageEmbeddingProvider(true, () -> {
            throw new IllegalStateException("checksum");
        });
        assertThat(broken.prepare()).isFalse();
        assertThat(broken.configured()).isFalse();
    }

    @Test
    void anUnreadablePhotoIsAnEmbeddingError() {
        LocalImageEmbeddingProvider provider = new LocalImageEmbeddingProvider(true, () -> MEAN_COLOUR);
        provider.prepare();
        assertThatThrownBy(() -> provider.embed("not a photo".getBytes(), "image/jpeg"))
                .isInstanceOf(ImageEmbeddingException.class);
    }

    @Test
    void preprocessingIsTheModelsCentreCrop() {
        BufferedImage wide = new BufferedImage(512, 256, BufferedImage.TYPE_INT_RGB);
        float[] input = OnnxDinoEncoder.preprocess(wide);
        assertThat(input).hasSize(3 * OnnxDinoEncoder.CROP * OnnxDinoEncoder.CROP);
        // Black, normalised with the ImageNet mean and std.
        assertThat(input[0]).isCloseTo(-0.485f / 0.229f, org.assertj.core.data.Offset.offset(1e-4f));
    }

    @Test
    void poolingJoinsTheClassTokenAndTheMeanPatchAndNormalises() {
        // 3 tokens of 2 values: class (3, 0), patches (0, 4) and (0, 2) -> [3, 0, 0, 3] / |.|.
        float[] pooled = OnnxDinoEncoder.pool(new float[] {3, 0, 0, 4, 0, 2}, 3, 2);
        assertThat(pooled).containsExactly(new float[] {0.70710677f, 0, 0, 0.70710677f},
                org.assertj.core.data.Offset.offset(1e-6f));
    }
}
