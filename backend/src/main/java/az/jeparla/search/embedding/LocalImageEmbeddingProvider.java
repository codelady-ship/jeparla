package az.jeparla.search.embedding;

import az.jeparla.common.onnx.ImageDecoder;
import az.jeparla.common.onnx.OnnxModelFile;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Locale;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Search by photo on the API's own CPU (#163): {@code JEPARLA_IMAGE_SEARCH_PROVIDER=local}. DINOv2 ViT-S/14
 * (Meta, Apache-2.0) as ONNX, 88 MB, a self-supervised image model that is good at "the same object from another
 * angle", which is what a buyer's screenshot or photo of a piece is. No paid or external API.
 *
 * <p>The model file is downloaded after start (pinned URL, SHA-256 checked) only when this provider is selected;
 * until it is loaded {@link #configured()} is false and the camera button says "not available yet". The photo is
 * embedded in memory and never stored or logged.
 */
@Component
public class LocalImageEmbeddingProvider implements ImageEmbeddingProvider {

    public static final String ID = "local";

    /** DINOv2 small, ONNX export of transformers.js (Xenova), pinned to a commit and checked by SHA-256. */
    public static final OnnxModelFile MODEL = new OnnxModelFile("dinov2-small.onnx",
            "https://huggingface.co/Xenova/dinov2-small/resolve/c2bb04a51fab207c420665f1946016107bffc701/onnx/model.onnx",
            "83141175ec78b4ff9a2bb58a4c7c264ba0054d1c2e122e5a8114b79a8d4179ea", 120_000_000L);

    private static final Logger log = LoggerFactory.getLogger(LocalImageEmbeddingProvider.class);

    private final boolean selected;
    private final Supplier<ImageEncoder> loader;
    private volatile ImageEncoder encoder;

    @Autowired
    public LocalImageEmbeddingProvider(@Value("${jeparla.search.image.provider:none}") String provider,
            @Value("${jeparla.search.image.threads:2}") int threads,
            @Value("${jeparla.models.dir:${java.io.tmpdir}/jeparla-models}") String modelsDir) {
        this(ID.equals(provider == null ? "" : provider.strip().toLowerCase(Locale.ROOT)),
                () -> load(Path.of(modelsDir), threads));
    }

    LocalImageEmbeddingProvider(boolean selected, Supplier<ImageEncoder> loader) {
        this.selected = selected;
        this.loader = loader;
    }

    private static ImageEncoder load(Path dir, int threads) {
        try {
            return new OnnxDinoEncoder(MODEL.ensure(dir), threads);
        } catch (IOException e) {
            throw new IllegalStateException("Image search model could not be prepared", e);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    void prepareInBackground() {
        if (selected && encoder == null) {
            Thread.ofVirtual().name("image-search-model").start(this::prepare);
        }
    }

    /** Loads the model now; false when it failed (logged; search by photo stays "not available"). */
    boolean prepare() {
        try {
            encoder = loader.get();
            log.info("Search by photo: local model {} ready", model());
            return true;
        } catch (RuntimeException e) {
            log.error("Search by photo provider local is selected but its model could not be loaded: {}",
                    e.toString());
            return false;
        }
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public boolean configured() {
        return encoder != null;
    }

    @Override
    public String model() {
        return "dinov2-small@" + MODEL.shortHash();
    }

    /**
     * Measured on the demo catalog (docs/image-search.md): the same piece from another photo scored 0.27-0.93,
     * different pieces of jewelry up to 0.77. Only clearly unrelated photos (not jewelry) fall below this.
     */
    @Override
    public double minSimilarity() {
        return 0.25;
    }

    @Override
    public float[] embed(byte[] image, String contentType) {
        ImageEncoder active = encoder;
        if (active == null) {
            throw new ImageEmbeddingException("The local image model is not loaded");
        }
        BufferedImage photo;
        try {
            photo = ImageDecoder.decode(image);
        } catch (IOException | RuntimeException e) {
            throw new ImageEmbeddingException("The photo could not be decoded");
        }
        try {
            return active.encode(photo);
        } catch (IOException e) {
            throw new ImageEmbeddingException("The image model failed");
        }
    }
}
