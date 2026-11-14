package az.jeparla.merchant;

import static az.jeparla.merchant.ProductRequestChecks.invalid;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageProbe.ImageInfo;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedUpload;
import az.jeparla.common.storage.ObjectStorage.StoredObject;
import az.jeparla.common.storage.StagedUploadChangedException;
import az.jeparla.merchant.dto.ImageAttachRequest;
import az.jeparla.merchant.dto.ImageOrderRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import az.jeparla.merchant.dto.MerchantImageDto;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.product.FirstOriginalPhotoAttached;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.product.ProductStatus;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Product photos (#39, #154, PLAN 5.13). The file goes from the browser through a presigned PUT into the
 * private staging area ({@link ObjectStorage}); the API never streams it. Before a file is attached the API
 * checks the staged object itself: it was issued for this product and is not too old, it exists, its size
 * is within the limit, and its first bytes are a JPEG, PNG or WebP of the type its key names (magic numbers,
 * not the client's {@code Content-Type}). Only then is it copied to the public bucket. A file that fails the
 * check is deleted; a file that is never attached is never public and is deleted by
 * {@link ImageUploadCleanupJob}.
 *
 * <p>Limits on presigns (#154): the rate-limit policy {@code image-upload-account} per seller (controller),
 * at most {@value #MAX_IMAGES} attached photos plus open uploads per product (409
 * {@code merchant.image_limit}), and {@link MerchantImageProperties#dailyUploadsPerStore} per store in 24
 * hours (429 with {@code Retry-After}).
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
    /** A file uploaded just before its URL expired can still be attached for this long. */
    static final Duration ATTACH_GRACE = Duration.ofMinutes(30);
    /** Window of the daily limit per store. */
    static final Duration DAILY_WINDOW = Duration.ofHours(24);

    /** Accepted types and the key extension of each. */
    static final Map<String, String> EXTENSIONS = Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private final MerchantProducts productService;
    private final ImageUploadSlotRepository slots;
    private final ObjectStorage storage;
    private final MerchantViews views;
    private final AuditService audit;
    private final MerchantImageProperties properties;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    public MerchantImageService(MerchantProducts productService, ImageUploadSlotRepository slots,
            ObjectStorage storage, MerchantViews views, AuditService audit, MerchantImageProperties properties,
            Clock clock, ApplicationEventPublisher events) {
        this.events = events;
        this.productService = productService;
        this.slots = slots;
        this.storage = storage;
        this.views = views;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * A presigned upload for one photo of the product: 400 for another type or a larger file, 409 when the
     * attached photos and the open uploads of the product reach {@value #MAX_IMAGES}, 429 over the daily
     * limit of the store.
     */
    @Transactional
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
        // Requests of one store count one after another: two at once cannot both take the last place.
        productService.lockStore(product);
        Instant now = clock.instant();
        if (product.getImages().size() + slots.countOpen(product.getId(), now) >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.image_limit");
        }
        long storeId = product.getStore().getId();
        Instant dayAgo = now.minus(DAILY_WINDOW);
        if (slots.countByStoreIdAndCreatedAtAfter(storeId, dayAgo) >= properties.dailyUploadsPerStore()) {
            Instant oldest = slots.findFirstByStoreIdAndCreatedAtAfterOrderByCreatedAtAsc(storeId, dayAgo)
                    .map(ImageUploadSlot::getCreatedAt).orElse(now);
            log.info("Daily photo upload limit reached by store {}", storeId);
            throw new RateLimitExceededException(
                    Math.max(1, Duration.between(now, oldest.plus(DAILY_WINDOW)).toSeconds() + 1));
        }
        String key = prefix(product) + UUID.randomUUID() + "." + extension;
        Instant expiresAt = now.plus(UPLOAD_TTL);
        slots.save(new ImageUploadSlot(key, product.getId(), storeId, now, expiresAt));
        PresignedUpload upload = storage.presignStagedUpload(key, type, request.sizeBytes(), UPLOAD_TTL);
        return new ImageUploadDto(key, upload.url(), upload.method(), upload.headers(), upload.expiresAt(), MAX_BYTES);
    }

    /**
     * Attaches an uploaded file. Attaching the same key again returns the image it already is (a double
     * submit); a new photo on an APPROVED product sends it back to review.
     */
    @Transactional
    public Created<MerchantImageDto> attach(long productId, ImageAttachRequest request) {
        Product product = productService.ownedWritable(productId);
        // A double submit waits here and then finds the image the first request attached.
        productService.lockStore(product);
        String key = request.key().strip();
        Optional<ProductImage> attached = product.getImages().stream()
                .filter(image -> image.getStorageKey().equals(key)).findFirst();
        if (attached.isPresent()) {
            return new Created<>(views.image(attached.get()), false);
        }
        if (!keyPattern(product).matcher(key).matches()) {
            throw invalid("merchant.image_key", "key");
        }
        if (product.getImages().size() >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.image_limit");
        }
        Instant now = clock.instant();
        ImageUploadSlot slot = slots.findByStorageKey(key)
                .filter(s -> s.getProductId() == product.getId() && s.isOpen()
                        && now.isBefore(s.getExpiresAt().plus(ATTACH_GRACE)))
                .orElseThrow(() -> invalid("merchant.image_missing", "key"));
        StoredObject stored = storage.headStaged(key).orElseThrow(() -> invalid("merchant.image_missing", "key"));
        if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MAX_BYTES) {
            discardStaged(key);
            throw invalid("merchant.image_size", "key");
        }
        String expected = EXTENSIONS.entrySet().stream()
                .filter(entry -> key.endsWith("." + entry.getValue())).map(Map.Entry::getKey).findFirst().orElseThrow();
        Optional<ImageInfo> info;
        try {
            info = ImageProbe.probe(storage.readStagedStart(key, stored, ImageProbe.HEADER_BYTES));
        } catch (StagedUploadChangedException e) {
            throw changedAfterCheck(key);
        }
        if (info.isEmpty() || !info.get().contentType().equals(expected)) {
            discardStaged(key);
            throw invalid("merchant.image_type", "key");
        }
        if (info.get().width() > MAX_SIDE || info.get().height() > MAX_SIDE) {
            discardStaged(key);
            throw invalid("merchant.image_dimensions", "key");
        }
        int sortOrder = product.getImages().stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        ProductImage image = new ProductImage(key, info.get().width(), info.get().height(), expected,
                stored.sizeBytes(), request.isAiGenerated(), sortOrder);
        String altAz = blankToNull(request.altAz());
        if (altAz != null || blankToNull(request.altEn()) != null || blankToNull(request.altRu()) != null) {
            image.setAlt(LocalizedText.of(altAz != null ? altAz : product.getName().az(), blankToNull(request.altEn()),
                    blankToNull(request.altRu())));
        }
        product.addImage(image);
        slot.attached(now);
        productService.afterChange(product, true, now);
        productService.flush();
        if (!image.isAiGenerated() && originals(product) == 1) {
            events.publishEvent(new FirstOriginalPhotoAttached(product.getId(), image.getId()));
        }
        audit.record("IMAGE_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"imageId\":" + image.getId() + ",\"aiGenerated\":" + image.isAiGenerated() + "}");
        // Registered before the copy (#158): a copy that succeeded on the server but failed in the client (a
        // timeout) rolls the attach back and still removes the public file.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    discard(key);
                }
            }
        });
        // Public only now, after the check and the rows, and only the object that was checked (#158).
        try {
            storage.publishStaged(key, stored);
        } catch (StagedUploadChangedException e) {
            throw changedAfterCheck(key);
        }
        return new Created<>(views.image(image), true);
    }

    /** The staged file was PUT again or removed after its check: it is deleted and never published (#158). */
    private ApiException changedAfterCheck(String key) {
        log.info("Staged upload {} changed after its check", key);
        discardStaged(key);
        return invalid("merchant.image_missing", "key");
    }

    /**
     * Removes a photo and, after the commit, its file. A listed product keeps at least one photo, and AI images
     * never stay alone (#121): the last original photo goes only after them (409 {@code merchant.last_original}).
     */
    @Transactional
    public void remove(long productId, long imageId) {
        Product product = productService.ownedWritable(productId);
        ProductImage image = product.getImages().stream().filter(i -> i.getId() == imageId).findFirst()
                .orElseThrow(ApiException::notFound);
        boolean listed = product.getStatus() == ProductStatus.APPROVED || product.getStatus() == ProductStatus.IN_REVIEW;
        if (listed && product.getImages().size() == 1) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.last_image");
        }
        if (!image.isAiGenerated() && originals(product) == 1 && product.getImages().size() > 1) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.last_original");
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

    /**
     * New photo order: every image id exactly once, the cover first. The cover is an original photo whenever the
     * product has one (#121): an AI image first is 400 {@code merchant.image_order_ai_first}.
     */
    @Transactional
    public MerchantProductDto reorder(long productId, ImageOrderRequest request) {
        Product product = productService.ownedWritable(productId);
        List<Long> ids = request.imageIds();
        List<Long> current = product.getImages().stream().map(ProductImage::getId).toList();
        if (ids.size() != current.size() || !new HashSet<>(ids).equals(new HashSet<>(current))) {
            throw invalid("merchant.image_order", "imageIds");
        }
        boolean aiFirst = product.getImages().stream()
                .anyMatch(image -> image.getId().equals(ids.get(0)) && image.isAiGenerated());
        if (aiFirst && originals(product) > 0) {
            throw invalid("merchant.image_order_ai_first", "imageIds");
        }
        for (ProductImage image : product.getImages()) {
            image.setSortOrder(ids.indexOf(image.getId()));
        }
        productService.flush();
        return views.product(product);
    }

    private static long originals(Product product) {
        return product.getImages().stream().filter(image -> !image.isAiGenerated()).count();
    }

    /** Keys are generated by {@link #upload}: {@code products/<store>/<product>/<uuid>.<ext>}. */
    private static String prefix(Product product) {
        return "products/" + product.getStore().getId() + "/" + product.getId() + "/";
    }

    private static Pattern keyPattern(Product product) {
        return Pattern.compile(Pattern.quote(prefix(product))
                + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)");
    }

    /** Best effort: a public file left behind is only storage, never shown (no row points at it). */
    private void discard(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete stored object {}: {}", key, e.toString());
        }
    }

    /** Best effort: a staged file left behind is private and removed by the cleanup job. */
    private void discardStaged(String key) {
        try {
            storage.deleteStaged(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete staged upload {}: {}", key, e.toString());
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
