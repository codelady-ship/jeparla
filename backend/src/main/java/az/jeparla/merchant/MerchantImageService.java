package az.jeparla.merchant;

import static az.jeparla.merchant.ProductRequestChecks.invalid;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageProbe.ImageInfo;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedUpload;
import az.jeparla.common.storage.ObjectStorage.StoredObject;
import az.jeparla.merchant.dto.ImageAttachRequest;
import az.jeparla.merchant.dto.ImageOrderRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import az.jeparla.merchant.dto.MerchantImageDto;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.product.ProductStatus;
import java.time.Clock;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Product photos (#39, PLAN 5.13). The file goes from the browser straight to the public bucket through a
 * presigned PUT; the API never streams it. Before a file is attached the API checks the stored object
 * itself: it exists under this product's key, its size is within the limit, and its first bytes are a
 * JPEG, PNG or WebP of the type its key names (magic numbers, not the client's {@code Content-Type}). A
 * file that fails the check is deleted.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantImageService {

    private static final Logger log = LoggerFactory.getLogger(MerchantImageService.class);

    /** Same limits as frontend/src/lib/merchant/images.ts and schemas.ts. */
    public static final long MAX_BYTES = 15L * 1024 * 1024;
    public static final int MAX_IMAGES = 8;
    /** Longest side accepted; larger photos are refused rather than resized here. */
    public static final int MAX_SIDE = 12_000;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(10);

    /** Accepted types and the key extension of each. */
    static final Map<String, String> EXTENSIONS = Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private final MerchantProducts productService;
    private final ObjectStorage storage;
    private final MerchantViews views;
    private final AuditService audit;
    private final Clock clock;

    public MerchantImageService(MerchantProducts productService, ObjectStorage storage, MerchantViews views,
            AuditService audit, Clock clock) {
        this.productService = productService;
        this.storage = storage;
        this.views = views;
        this.audit = audit;
        this.clock = clock;
    }

    /** A presigned upload for one photo of the product: 400 for another type or a larger file. */
    @Transactional(readOnly = true)
    public ImageUploadDto upload(long productId, ImageUploadRequest request) {
        Product product = productService.ownedWritable(productId);
        String type = request.contentType().strip().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(type);
        if (extension == null) {
            throw invalid("merchant.image_type", "contentType");
        }
        if (request.sizeBytes() > MAX_BYTES) {
            throw invalid("merchant.image_size", "sizeBytes");
        }
        requireRoom(product);
        String key = prefix(product) + UUID.randomUUID() + "." + extension;
        PresignedUpload upload = storage.presignUpload(key, type, request.sizeBytes(), UPLOAD_TTL);
        return new ImageUploadDto(key, upload.url(), upload.method(), upload.headers(), upload.expiresAt(), MAX_BYTES);
    }

    /**
     * Attaches an uploaded file. Attaching the same key again returns the image it already is (a double
     * submit); a new photo on an APPROVED product sends it back to review.
     */
    @Transactional
    public Created<MerchantImageDto> attach(long productId, ImageAttachRequest request) {
        Product product = productService.ownedWritable(productId);
        String key = request.key().strip();
        Optional<ProductImage> attached = product.getImages().stream()
                .filter(image -> image.getStorageKey().equals(key)).findFirst();
        if (attached.isPresent()) {
            return new Created<>(views.image(attached.get()), false);
        }
        if (!keyPattern(product).matcher(key).matches()) {
            throw invalid("merchant.image_key", "key");
        }
        requireRoom(product);
        StoredObject stored = storage.head(key).orElseThrow(() -> invalid("merchant.image_missing", "key"));
        if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MAX_BYTES) {
            discard(key);
            throw invalid("merchant.image_size", "key");
        }
        String expected = EXTENSIONS.entrySet().stream()
                .filter(entry -> key.endsWith("." + entry.getValue())).map(Map.Entry::getKey).findFirst().orElseThrow();
        Optional<ImageInfo> info = ImageProbe.probe(storage.readStart(key, ImageProbe.HEADER_BYTES));
        if (info.isEmpty() || !info.get().contentType().equals(expected)) {
            discard(key);
            throw invalid("merchant.image_type", "key");
        }
        if (info.get().width() > MAX_SIDE || info.get().height() > MAX_SIDE) {
            discard(key);
            throw invalid("merchant.image_dimensions", "key");
        }
        int sortOrder = product.getImages().stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        ProductImage image = new ProductImage(key, info.get().width(), info.get().height(), expected,
                stored.sizeBytes(), request.aiGenerated(), sortOrder);
        String altAz = blankToNull(request.altAz());
        if (altAz != null || blankToNull(request.altEn()) != null || blankToNull(request.altRu()) != null) {
            image.setAlt(LocalizedText.of(altAz != null ? altAz : product.getName().az(), blankToNull(request.altEn()),
                    blankToNull(request.altRu())));
        }
        product.addImage(image);
        productService.afterChange(product, true, clock.instant());
        productService.flush();
        audit.record("IMAGE_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"imageId\":" + image.getId() + ",\"aiGenerated\":" + image.isAiGenerated() + "}");
        return new Created<>(views.image(image), true);
    }

    /** Removes a photo and, after the commit, its file. A listed product keeps at least one photo. */
    @Transactional
    public void remove(long productId, long imageId) {
        Product product = productService.ownedWritable(productId);
        ProductImage image = product.getImages().stream().filter(i -> i.getId() == imageId).findFirst()
                .orElseThrow(ApiException::notFound);
        boolean listed = product.getStatus() == ProductStatus.APPROVED || product.getStatus() == ProductStatus.IN_REVIEW;
        if (listed && product.getImages().size() == 1) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.last_image");
        }
        String key = image.getStorageKey();
        product.removeImage(image);
        productService.flush();
        audit.record("IMAGE_REMOVED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"imageId\":" + imageId + "}");
        if (!key.startsWith("demo/")) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    discard(key);
                }
            });
        }
    }

    /** New photo order: every image id exactly once, the cover first. */
    @Transactional
    public MerchantProductDto reorder(long productId, ImageOrderRequest request) {
        Product product = productService.ownedWritable(productId);
        List<Long> ids = request.imageIds();
        List<Long> current = product.getImages().stream().map(ProductImage::getId).toList();
        if (ids.size() != current.size() || !new HashSet<>(ids).equals(new HashSet<>(current))) {
            throw invalid("merchant.image_order", "imageIds");
        }
        for (ProductImage image : product.getImages()) {
            image.setSortOrder(ids.indexOf(image.getId()));
        }
        productService.flush();
        return views.product(product);
    }

    private static void requireRoom(Product product) {
        if (product.getImages().size() >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.image_limit");
        }
    }

    /** Keys are generated by {@link #upload}: {@code products/<store>/<product>/<uuid>.<ext>}. */
    private static String prefix(Product product) {
        return "products/" + product.getStore().getId() + "/" + product.getId() + "/";
    }

    private static Pattern keyPattern(Product product) {
        return Pattern.compile(Pattern.quote(prefix(product))
                + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)");
    }

    /** Best effort: a file left behind is only storage, never shown (no row points at it). */
    private void discard(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete stored object {}: {}", key, e.toString());
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
