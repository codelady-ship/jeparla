package az.jeparla.ai.studio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/**
 * The studio look composition (#119) with a stand-in segmenter (no model in CI): the "item" is every pixel that
 * is far from the photo's grey background.
 */
class StudioComposerTests {

    private static final int GOLD = 0xC8A050;

    /** Grey background with a gold disc at (cx, cy). */
    private static BufferedImage photo(int width, int height, int cx, int cy, int radius) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(new Color(0x404040));
        g.fillRect(0, 0, width, height);
        g.setColor(new Color(GOLD));
        g.fillOval(cx - radius, cy - radius, 2 * radius, 2 * radius);
        g.dispose();
        return image;
    }

    /** Mask: 1 where the pixel is gold-ish, 0 on the grey background. */
    private static final Segmenter BY_COLOUR = image -> {
        int w = image.getWidth();
        int h = image.getHeight();
        float[] mask = new float[w * h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int p = image.getRGB(x, y);
                mask[y * w + x] = ((p >> 16) & 0xFF) > 120 ? 1f : 0f;
            }
        }
        return mask;
    };

    private static int red(int rgb) {
        return (rgb >> 16) & 0xFF;
    }

    @Test
    void itemIsCentredOnCreamInA4to5Frame() throws IOException {
        BufferedImage out = new StudioComposer(BY_COLOUR).render(photo(600, 400, 150, 120, 60),
                StudioComposer.Size.AUTO);

        assertThat(out.getWidth()).isEqualTo(StudioComposer.MIN_OUTPUT_WIDTH);
        assertThat(out.getHeight() * 4).isEqualTo(out.getWidth() * 5);
        // The old grey background is gone: corners and edges are the cream token.
        assertThat(out.getRGB(0, 0) & 0xFFFFFF).isEqualTo(StudioComposer.BACKGROUND);
        assertThat(out.getRGB(out.getWidth() - 1, out.getHeight() - 1) & 0xFFFFFF)
                .isEqualTo(StudioComposer.BACKGROUND);
        // The item moved from the top left of the photo to the middle of the frame.
        int centre = out.getRGB(out.getWidth() / 2, Math.round(out.getHeight() * 0.48f));
        assertThat(Math.abs(red(centre) - red(GOLD))).isLessThanOrEqualTo(red(GOLD) * 15 / 100);
        // It fills about 70% of the width.
        int left = 0;
        while (red(out.getRGB(left, Math.round(out.getHeight() * 0.48f))) > 230) {
            left++;
        }
        assertThat(left).isBetween(Math.round(out.getWidth() * 0.13f), Math.round(out.getWidth() * 0.17f));
    }

    @Test
    void itemHueIsKept() throws IOException {
        BufferedImage out = new StudioComposer(BY_COLOUR).render(photo(500, 500, 250, 250, 100),
                new StudioComposer.Size(400, 500));
        int p = out.getRGB(200, 240);
        int r = red(p);
        int g = (p >> 8) & 0xFF;
        int b = p & 0xFF;
        // One exposure factor for all channels: the gold's channel ratios stay.
        assertThat((double) g / r).isCloseTo((double) 0xA0 / 0xC8, org.assertj.core.data.Offset.offset(0.03));
        assertThat((double) b / r).isCloseTo((double) 0x50 / 0xC8, org.assertj.core.data.Offset.offset(0.03));
    }

    @Test
    void aShadowFallsBelowTheItem() throws IOException {
        BufferedImage out = new StudioComposer(BY_COLOUR).render(photo(500, 500, 250, 250, 100),
                new StudioComposer.Size(800, 1000));
        int below = 0;
        for (int y = 520; y < 1000; y++) {
            int p = out.getRGB(400, y) & 0xFFFFFF;
            if (red(p) < 250 && red(p) > 200) {
                below = y;
                break;
            }
        }
        assertThat(below).as("a darker cream row under the item").isPositive();
    }

    @Test
    void anItemCutByThePhotoEdgeStaysAtTheFrameEdge() throws IOException {
        // A disc cut by the top edge of the photo, like a chain running out of the shot.
        BufferedImage out = new StudioComposer(BY_COLOUR).render(photo(500, 500, 250, 0, 120),
                new StudioComposer.Size(400, 500));
        assertThat(red(out.getRGB(200, 0))).isLessThan(230);
    }

    @Test
    void noItemFailsInsteadOfAnEmptyFrame() {
        BufferedImage empty = photo(300, 300, -100, -100, 1);
        assertThatThrownBy(() -> new StudioComposer(BY_COLOUR).render(empty, StudioComposer.Size.AUTO))
                .isInstanceOf(StudioComposer.NoItemException.class);
    }

    @Test
    void specksAreDropped() {
        float[] mask = new float[100 * 100];
        for (int y = 20; y < 80; y++) {
            for (int x = 20; x < 80; x++) {
                mask[y * 100 + x] = 1;
            }
        }
        mask[5 * 100 + 5] = 1;
        float[] refined = StudioComposer.refine(mask, 100, 100);
        assertThat(refined[5 * 100 + 5]).isZero();
        assertThat(refined[50 * 100 + 50]).isEqualTo(1f);
    }

    @Test
    void theJpegSaysItIsAProcessedPhoto() throws IOException {
        byte[] jpeg = new StudioComposer(BY_COLOUR).compose(photo(400, 500, 200, 250, 80),
                StudioComposer.Size.AUTO);
        assertThat(ImageIO.read(new ByteArrayInputStream(jpeg))).isNotNull();
        assertThat(new String(jpeg, 0, 200, StandardCharsets.ISO_8859_1)).contains("Jeparla studio look");
    }
}
