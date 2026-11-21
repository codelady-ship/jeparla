package az.jeparla.ai.studio;

import az.jeparla.ai.provider.GenerationRequest;
import az.jeparla.ai.provider.GenerationResult;
import az.jeparla.ai.provider.ImageGenerationException;
import az.jeparla.ai.provider.ImageGenerationProvider;
import az.jeparla.common.onnx.ImageDecoder;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.common.storage.ObjectStorage;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * The local, non-generative STUDIO_LOOK processor (#119): {@code JEPARLA_AI_STUDIO_PROCESSOR=local}. A background
 * removal model (IS-Net by default, {@link SegmentationModel}) finds the item on the API's own CPU, and
 * {@link StudioComposer} puts it on the cream background. Nothing leaves the server and nothing is paid per photo.
 *
 * <p>The model file is downloaded (pinned URL, SHA-256 checked) and loaded in the background after start, only when
 * this processor is selected; until then {@link #configured()} is false and the studio look shows as "not
 * connected". The original photo is read from the public bucket and never changed; the result goes through the
 * usual AI Studio flow (private file, seller approval) as a non-generative asset.
 */
@Component
public class LocalStudioProcessor implements ImageGenerationProvider {

    public static final String ID = "local";
    /** Same limit as product photos (MerchantImageService). */
    static final int MAX_SOURCE_BYTES = 15 * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(LocalStudioProcessor.class);

    private final ObjectStorage storage;
    private final ImageUrls imageUrls;
    private final boolean selected;
    private final Supplier<Segmenter> loader;
    private volatile StudioComposer composer;

    @Autowired
    public LocalStudioProcessor(ObjectStorage storage, ImageUrls imageUrls,
            @Value("${jeparla.ai.studio-processor:none}") String processor,
            @Value("${jeparla.ai.studio.model:isnet}") String model,
            @Value("${jeparla.ai.studio.threads:2}") int threads,
            @Value("${jeparla.models.dir:${java.io.tmpdir}/jeparla-models}") String modelsDir) {
        this(storage, imageUrls, ID.equals(processor == null ? "" : processor.strip().toLowerCase(Locale.ROOT)),
                () -> load(SegmentationModel.of(model), Path.of(modelsDir), threads));
    }

    LocalStudioProcessor(ObjectStorage storage, ImageUrls imageUrls, boolean selected, Supplier<Segmenter> loader) {
        this.storage = storage;
        this.imageUrls = imageUrls;
        this.selected = selected;
        this.loader = loader;
    }

    private static Segmenter load(SegmentationModel model, Path dir, int threads) {
        try {
            return new OnnxSegmenter(model, model.file().ensure(dir), threads);
        } catch (IOException e) {
            throw new IllegalStateException("Studio look model " + model.id() + " could not be prepared", e);
        }
    }

    /** Downloads and loads the model off the startup thread, only when this processor is selected. */
    @EventListener(ApplicationReadyEvent.class)
    void prepareInBackground() {
        if (selected && composer == null) {
            Thread.ofVirtual().name("studio-look-model").start(this::prepare);
        }
    }

    /** Loads the model now; false when it failed (logged; the studio look stays "not connected"). */
    boolean prepare() {
        try {
            Segmenter segmenter = loader.get();
            composer = new StudioComposer(segmenter);
            log.info("Studio look processor ready");
            return true;
        } catch (RuntimeException e) {
            log.error("Studio look processor is selected but its model could not be loaded: {}", e.toString());
            return false;
        }
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public boolean configured() {
        return composer != null;
    }

    @Override
    public BigDecimal estimatedCost(GenerationRequest request) {
        return BigDecimal.ZERO;
    }

    @Override
    public boolean generative() {
        return false;
    }

    @Override
    public boolean local() {
        return true;
    }

    @Override
    public GenerationResult generate(GenerationRequest request) {
        StudioComposer active = composer;
        if (active == null) {
            throw new ImageGenerationException(ImageGenerationException.NOT_CONFIGURED, "Studio look model not loaded");
        }
        Optional<byte[]> source = imageUrls.key(request.sourceImageUrl())
                .flatMap(key -> storage.readPublic(key, MAX_SOURCE_BYTES));
        if (source.isEmpty()) {
            throw new ImageGenerationException("ai.source_gone", "Source photo of job " + request.jobId()
                    + " is not in the public bucket");
        }
        BufferedImage photo;
        try {
            photo = ImageDecoder.decode(source.get());
        } catch (IOException | RuntimeException e) {
            throw new ImageGenerationException("ai.bad_result", "Source photo of job " + request.jobId()
                    + " could not be decoded: " + e.getMessage());
        }
        try {
            byte[] jpeg = active.compose(photo, StudioComposer.Size.AUTO);
            return new GenerationResult(List.of(new GenerationResult.GeneratedImage(jpeg)), BigDecimal.ZERO);
        } catch (StudioComposer.NoItemException e) {
            throw new ImageGenerationException("ai.bad_result", "No item found in the photo of job " + request.jobId());
        } catch (IOException e) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                    "Studio look failed for job " + request.jobId() + ": " + e.getMessage(), e);
        }
    }
}
