package az.jeparla.search.embedding;

import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Picks the active {@link ImageEmbeddingProvider} at startup from {@code jeparla.search.image.provider}:
 * {@code none} (the default) is {@link DisabledImageEmbeddingProvider}; any other value must be the id of an
 * installed provider bean, or the API does not start (a typo must not silently turn the feature off).
 */
@Component
public class ImageEmbeddingProviders {

    private static final Logger log = LoggerFactory.getLogger(ImageEmbeddingProviders.class);

    private final ImageEmbeddingProvider active;

    @Autowired
    public ImageEmbeddingProviders(ObjectProvider<ImageEmbeddingProvider> candidates,
            @Value("${jeparla.search.image.provider:none}") String selected) {
        this(candidates.orderedStream().toList(), selected);
    }

    ImageEmbeddingProviders(List<ImageEmbeddingProvider> candidates, String selected) {
        String id = selected == null || selected.isBlank() ? DisabledImageEmbeddingProvider.ID
                : selected.strip().toLowerCase(Locale.ROOT);
        if (id.equals(DisabledImageEmbeddingProvider.ID)) {
            log.info("Search by photo: no embedding model (requests answer 503 search.image_not_configured)");
            this.active = new DisabledImageEmbeddingProvider();
            return;
        }
        this.active = candidates.stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> new IllegalStateException("jeparla.search.image.provider=" + id
                        + " but no such provider is installed (docs/image-search.md)"));
        if (!active.configured()) {
            log.warn("Search by photo provider {} is selected but not configured", id);
        }
    }

    /** The provider in use; never null. */
    public ImageEmbeddingProvider active() {
        return active;
    }
}
