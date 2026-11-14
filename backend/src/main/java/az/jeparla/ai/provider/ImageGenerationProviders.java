package az.jeparla.ai.provider;

import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Picks the active {@link ImageGenerationProvider} at startup from {@code jeparla.ai.image-provider}: {@code none}
 * (the default) is {@link DisabledImageGenerationProvider}; any other value must be the {@link
 * ImageGenerationProvider#id() id} of a provider bean, or the API does not start (a typo must not silently turn
 * AI Studio off in production).
 */
@Component
public class ImageGenerationProviders {

    private static final Logger log = LoggerFactory.getLogger(ImageGenerationProviders.class);

    private final ImageGenerationProvider active;

    public ImageGenerationProviders(ObjectProvider<ImageGenerationProvider> candidates,
            @Value("${jeparla.ai.image-provider:none}") String selected) {
        this(candidates.orderedStream().toList(), selected);
    }

    ImageGenerationProviders(List<ImageGenerationProvider> candidates, String selected) {
        this.active = select(candidates, selected);
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

    /** The provider jobs run on; never null. */
    public ImageGenerationProvider active() {
        return active;
    }
}
