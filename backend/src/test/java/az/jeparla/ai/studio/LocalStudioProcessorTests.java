package az.jeparla.ai.studio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.ai.provider.GenerationRequest;
import az.jeparla.ai.provider.GenerationResult;
import az.jeparla.ai.provider.ImageGenerationException;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.StorageProperties;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/** The local STUDIO_LOOK processor (#119) with a stand-in segmenter: CI never downloads the model. */
class LocalStudioProcessorTests {

    private final ObjectStorage storage = mock(ObjectStorage.class);
    private final ImageUrls urls = new ImageUrls(new StorageProperties("https://img.example.org/public"));

    private static final Segmenter BRIGHT = image -> {
        float[] mask = new float[image.getWidth() * image.getHeight()];
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                mask[y * image.getWidth() + x] = ((image.getRGB(x, y) >> 16) & 0xFF) > 120 ? 1f : 0f;
            }
        }
        return mask;
    };

    private static byte[] photo() throws IOException {
        BufferedImage image = new BufferedImage(600, 600, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.DARK_GRAY);
        g.fillRect(0, 0, 600, 600);
        g.setColor(new Color(0xD0B070));
        g.fillOval(200, 200, 200, 200);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpeg", out);
        return out.toByteArray();
    }

    private static GenerationRequest request(String url) {
        return new GenerationRequest(7, "STUDIO_LOOK", url, "", List.of(), 1, "4:5", Map.of());
    }

    @Test
    void notConfiguredUntilTheModelIsLoaded() {
        LocalStudioProcessor processor = new LocalStudioProcessor(storage, urls, true, () -> BRIGHT);
        assertThat(processor.configured()).isFalse();
        assertThatThrownBy(() -> processor.generate(request("https://img.example.org/public/p/1.jpg")))
                .isInstanceOf(ImageGenerationException.class)
                .extracting(e -> ((ImageGenerationException) e).code()).isEqualTo(ImageGenerationException.NOT_CONFIGURED);

        assertThat(processor.prepare()).isTrue();
        assertThat(processor.configured()).isTrue();
    }

    @Test
    void aFailedModelLoadLeavesItOff() {
        LocalStudioProcessor processor = new LocalStudioProcessor(storage, urls, true, () -> {
            throw new IllegalStateException("download failed");
        });
        assertThat(processor.prepare()).isFalse();
        assertThat(processor.configured()).isFalse();
    }

    @Test
    void notSelectedMeansNoDownload() {
        LocalStudioProcessor processor = new LocalStudioProcessor(storage, urls, false, () -> {
            throw new AssertionError("must not load");
        });
        processor.prepareInBackground();
        assertThat(processor.configured()).isFalse();
    }

    @Test
    void readsTheOriginalFromStorageAndReturnsOneFreeNonGenerativeJpeg() throws IOException {
        when(storage.readPublic(eq("products/1/a.jpg"), anyInt())).thenReturn(Optional.of(photo()));
        LocalStudioProcessor processor = new LocalStudioProcessor(storage, urls, true, () -> BRIGHT);
        processor.prepare();

        GenerationResult result = processor.generate(request("https://img.example.org/public/products/1/a.jpg"));

        assertThat(result.images()).hasSize(1);
        assertThat(result.cost()).isEqualByComparingTo(BigDecimal.ZERO);
        var info = ImageProbe.probe(result.images().getFirst().bytes()).orElseThrow();
        assertThat(info.contentType()).isEqualTo("image/jpeg");
        assertThat(info.height() * 4).isEqualTo(info.width() * 5);
        assertThat(processor.generative()).isFalse();
        assertThat(processor.local()).isTrue();
        assertThat(processor.estimatedCost(request("x"))).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(processor.id()).isEqualTo("local");
    }

    @Test
    void aPhotoOutsideTheBucketIsNotFetched() {
        LocalStudioProcessor processor = new LocalStudioProcessor(storage, urls, true, () -> BRIGHT);
        processor.prepare();

        assertThatThrownBy(() -> processor.generate(request("https://elsewhere.example.com/a.jpg")))
                .isInstanceOf(ImageGenerationException.class)
                .extracting(e -> ((ImageGenerationException) e).code()).isEqualTo("ai.source_gone");
        verify(storage, never()).readPublic(org.mockito.ArgumentMatchers.anyString(), anyInt());
    }

    @Test
    void aPhotoWithoutAnItemFailsAsBadResult() throws IOException {
        when(storage.readPublic(eq("p/empty.jpg"), anyInt())).thenReturn(Optional.of(photo()));
        Segmenter nothing = image -> new float[image.getWidth() * image.getHeight()];
        LocalStudioProcessor processor = new LocalStudioProcessor(storage, urls, true, () -> nothing);
        processor.prepare();

        assertThatThrownBy(() -> processor.generate(request("https://img.example.org/public/p/empty.jpg")))
                .isInstanceOf(ImageGenerationException.class)
                .extracting(e -> ((ImageGenerationException) e).code()).isEqualTo("ai.bad_result");
    }
}
