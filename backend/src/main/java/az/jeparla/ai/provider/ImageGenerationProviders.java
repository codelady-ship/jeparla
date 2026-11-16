package az.jeparla.ai.provider;

import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Picks the active {@link ImageGenerationProvider} at startup from {@code jeparla.ai.image-provider}: {@code none}
 * (the default) is {@link DisabledImageGenerationProvider}; any other value must be the {@link
 * ImageGenerationProvider#id() id} of a provider bean, or the API does not start (a typo must not silently turn
 * AI Studio off in production).
 *
 * <p>STUDIO_LOOK jobs (#119) run on their own processor, {@code jeparla.ai.studio-processor} ({@code none} by
 * default): a non-generative clean-up (background removal, crop, shadow), usually local on the API's CPU.
 */
@Component
public class ImageGenerationProviders {

    private static final Logger log = LoggerFactory.getLogger(ImageGenerationProviders.class);

    private final ImageGenerationProvider active;
    private final ImageGenerationProvider studio;

    @Autowired
    public ImageGenerationProviders(ObjectProvider<ImageGenerationProvider> candidates,
            @Value("${jeparla.ai.image-provider:none}") String selected,
            @Value("${jeparla.ai.studio-processor:none}") String studioProcessor) {
        this(candidates.orderedStream().toList(), selected, studioProcessor);
    }

    ImageGenerationProviders(List<ImageGenerationProvider> candidates, String selected) {
        this(candidates, selected, DisabledImageGenerationProvider.ID);
    }

    ImageGenerationProviders(List<ImageGenerationProvider> candidates, String selected, String studioProcessor) {
        this.active = select(candidates, selected);
        this.studio = select(candidates, studioProcessor);
    }

    static ImageGenerationProvider select(List<ImageGenerationProvider> candidates, String selected) {
        String id = selected == null || selected.isBlank() ? DisabledImageGenerationProvider.ID
                : selected.strip().toLowerCase(Locale.ROOT);
        if (id.equals(DisabledImageGenerationProvider.ID)) {
            log.info("AI Studio image provider: none (job requests answer 503 ai.not_configured)");
            return new DisabledImageGenerationProvider();
        }
        ImageGenerationProvider provider = candidates.stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> new IllegalStateException("jeparla.ai.image-provider=" + id
                        + " but no such provider is installed (docs/ai-providers.md)"));
        if (!provider.configured()) {
            log.warn("AI Studio image provider {} is selected but not configured: job requests answer 503", id);
        }
        return provider;
    }

    /** The provider AI_PHOTOSHOOT and VIRTUAL_TRY_ON jobs run on; never null. */
    public ImageGenerationProvider active() {
        return active;
    }

    /** The processor of STUDIO_LOOK jobs (#119); never null. */
    public ImageGenerationProvider studio() {
        return studio;
    }

    /** The provider of a job kind, named by its {@code name()}: STUDIO_LOOK has its own processor. */
    public ImageGenerationProvider forKind(String kind) {
        return "STUDIO_LOOK".equals(kind) ? studio : active;
    }

    /** Whether any kind can take jobs (the worker idles otherwise). */
    public boolean anyConfigured() {
        return active.configured() || studio.configured();
    }
}
