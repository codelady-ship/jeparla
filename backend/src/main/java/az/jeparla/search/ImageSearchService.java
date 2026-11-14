package az.jeparla.search;

import az.jeparla.common.error.ApiException;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageProbe.ImageInfo;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.search.dto.ImageSearchStatusDto;
import az.jeparla.search.embedding.ImageEmbeddingException;
import az.jeparla.search.embedding.ImageEmbeddingProvider;
import az.jeparla.search.embedding.ImageEmbeddingProviders;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Search by photo (#163): the buyer's photo is checked by its magic number (JPEG, PNG or WebP), size and
 * dimensions, embedded in memory and compared with the embeddings of listed product photos. The photo is never
 * stored or logged: it exists only in this request. Without an embedding model the answer is 503
 * {@code search.image_not_configured}, never sample results.
 */
@Service
public class ImageSearchService {

    /** The browser sends a downscaled copy (768 px); a camera original up to this size is still accepted. */
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    static final int MAX_SIDE = 6000;
    static final int RESULTS = 24;
    /** Below this cosine a photo is not "similar" at all: an empty answer beats a random one. */
    static final double MIN_SIMILARITY = 0.2;

    private static final Logger log = LoggerFactory.getLogger(ImageSearchService.class);

    private final ImageEmbeddingProviders providers;
    private final ImageEmbeddings embeddings;
    private final ProductCatalogService catalog;

    public ImageSearchService(ImageEmbeddingProviders providers, ImageEmbeddings embeddings,
            ProductCatalogService catalog) {
        this.providers = providers;
        this.embeddings = embeddings;
        this.catalog = catalog;
    }

    public ImageSearchStatusDto status() {
        return new ImageSearchStatusDto(providers.active().configured(), MAX_BYTES);
    }

    /** Listed products most similar to the photo, best first (at most {@value #RESULTS}); may be empty. */
    @Transactional(readOnly = true)
    public List<ProductSummaryDto> search(byte[] photo) {
        ImageEmbeddingProvider provider = providers.active();
        if (!provider.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "search.image_not_configured");
        }
        ImageInfo info = check(photo);
        float[] query;
        try {
            query = provider.embed(photo, info.contentType());
        } catch (ImageEmbeddingException e) {
            // Only the reason, never the photo.
            log.info("Search by photo: the model could not read a {} photo: {}", info.contentType(), e.getMessage());
            throw new ApiException(HttpStatus.BAD_REQUEST, "search.image_unreadable", "image");
        }
        List<Long> ids = ImageSimilarity.rank(query, embeddings.candidates(provider.model()), RESULTS,
                MIN_SIMILARITY);
        return ids.isEmpty() ? List.of() : catalog.byIds(ids);
    }

    /** Magic number, size and dimensions; the client's Content-Type is not trusted. */
    static ImageInfo check(byte[] photo) {
        if (photo == null || photo.length == 0 || photo.length > MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "search.image_size", "image");
        }
        Optional<ImageInfo> info = ImageProbe.probe(photo);
        if (info.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "search.image_type", "image");
        }
        if (info.get().width() > MAX_SIDE || info.get().height() > MAX_SIDE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "search.image_size", "image");
        }
        return info.get();
    }
}
