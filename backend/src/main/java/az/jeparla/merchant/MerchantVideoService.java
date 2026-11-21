package az.jeparla.merchant;

import static az.jeparla.merchant.ProductRequestChecks.invalid;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedUpload;
import az.jeparla.common.storage.ObjectStorage.StoredObject;
import az.jeparla.common.storage.StagedUploadChangedException;
import az.jeparla.common.storage.VideoProbe;
import az.jeparla.common.storage.VideoProbe.VideoInfo;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import az.jeparla.merchant.dto.MerchantVideoDto;
import az.jeparla.merchant.dto.VideoAttachRequest;
import az.jeparla.product.Product;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductVideo;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The short video of a product (#117): one clip of up to {@value #MAX_SECONDS} seconds and 8 MB, MP4 (H.264) or
 * WebM. It travels like a photo ({@link MerchantImageService}): a presigned PUT into the private staging area,
 * then the API checks the staged object itself before anything is public: it was issued for this product, it
 * exists, its size is within the limit, and its container ({@link VideoProbe}: magic numbers, codec, duration)
 * is the type its key names and not longer than allowed. Only then is it copied to the public bucket. Nothing is
 * transcoded (the free VM has no CPU for it): a file in another format is refused with the reason.
 *
 * <p>Limits: the presign rate limit per seller (controller) and the daily upload limit per store, shared with
 * the photos; at most {@value #MAX_OPEN_UPLOADS} open video uploads per product; and
 * {@link MerchantVideoProperties#maxPerStore} products with a video per store (409
 * {@code merchant.video_quota}), so one store cannot fill the free storage plan.
 *
 * <p>Ownership is checked on every call ({@link MerchantProducts#ownedWritable}): another seller's product is
 * 403, a missing one 404.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantVideoService {

    private static final Logger log = LoggerFactory.getLogger(MerchantVideoService.class);

    /** Same limits as frontend/src/lib/merchant/video.ts. */
    public static final long MAX_BYTES = 8L * 1024 * 1024;
    public static final int MAX_SECONDS = 15;
    /**
     * A phone that stops at "15 seconds" writes a few frames more into the header; half a second of slack keeps
     * such a clip from being refused.
     */
    static final long MAX_DURATION_MS = MAX_SECONDS * 1000L + 500;
    public static final int MAX_OPEN_UPLOADS = 3;
    private static final String FILE_NAME = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(mp4|webm)";

    /** Accepted types and the key extension of each. */
    static final Map<String, String> EXTENSIONS = Map.of(VideoProbe.MP4, "mp4", VideoProbe.WEBM, "webm");

    private final MerchantProducts productService;
    private final ProductRepository products;
    private final ImageUploadSlotRepository slots;
    private final ObjectStorage storage;
    private final MerchantViews views;
    private final AuditService audit;
    private final MerchantImageProperties imageProperties;
    private final MerchantVideoProperties properties;
    private final Clock clock;
    /** Outlives the rollback of a refused attach. */
    private final TransactionTemplate ownTransaction;

    public MerchantVideoService(MerchantProducts productService, ProductRepository products,
            ImageUploadSlotRepository slots, ObjectStorage storage, MerchantViews views, AuditService audit,
            MerchantImageProperties imageProperties, MerchantVideoProperties properties, Clock clock,
            PlatformTransactionManager transactions) {
        this.productService = productService;
        this.products = products;
        this.slots = slots;
        this.storage = storage;
        this.views = views;
        this.audit = audit;
        this.imageProperties = imageProperties;
        this.properties = properties;
        this.clock = clock;
        this.ownTransaction = new TransactionTemplate(transactions);
        this.ownTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }


    /**
     * A presigned upload for the video of the product: 400 for another type or a larger file, 409
     * {@code merchant.video_quota} when the store's other products already hold all its videos, 409
     * {@code merchant.video_upload_limit} with {@value #MAX_OPEN_UPLOADS} open uploads, 429 over the daily upload
     * limit of the store.
     */
    @Transactional
    public ImageUploadDto upload(long productId, ImageUploadRequest request) {
        Product product = productService.ownedWritable(productId);
        String type = request.contentType().strip().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(type);
        if (extension == null) {
            throw invalid("merchant.video_type", "contentType");
        }
        if (request.sizeBytes() > MAX_BYTES) {
            throw invalid("merchant.video_size", "sizeBytes");
        }
        // Requests of one store count one after another: two at once cannot both take the last place.
        productService.lockStore(product);
        requireQuota(product);
        Instant now = clock.instant();
        if (slots.countOpen(product.getId(), ImageUploadKind.VIDEO, now) >= MAX_OPEN_UPLOADS) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.video_upload_limit");
        }
        long storeId = product.getStore().getId();
        Instant dayAgo = now.minus(MerchantImageService.DAILY_WINDOW);
        if (slots.countByStoreIdAndCreatedAtAfter(storeId, dayAgo) >= imageProperties.dailyUploadsPerStore()) {
            Instant oldest = slots.findFirstByStoreIdAndCreatedAtAfterOrderByCreatedAtAsc(storeId, dayAgo)
                    .map(ImageUploadSlot::getCreatedAt).orElse(now);
            log.info("Daily upload limit reached by store {}", storeId);
            throw new RateLimitExceededException(Math.max(1,
                    Duration.between(now, oldest.plus(MerchantImageService.DAILY_WINDOW)).toSeconds() + 1));
        }
        String key = prefix(product) + UUID.randomUUID() + "." + extension;
        slots.save(new ImageUploadSlot(key, product.getId(), storeId, ImageUploadKind.VIDEO, now,
                now.plus(MerchantImageService.UPLOAD_TTL)));
        PresignedUpload upload = storage.presignStagedUpload(key, type, request.sizeBytes(),
                MerchantImageService.UPLOAD_TTL);
        return new ImageUploadDto(key, upload.url(), upload.method(), upload.headers(), upload.expiresAt(), MAX_BYTES);
    }

    /**
     * Sets the video of the product from an upload of {@link #upload}. The video the product had is replaced (its
     * file is deleted after the commit); setting the same key again returns the video it already is. A new video on
     * an APPROVED product sends it back to review, like a new photo, so it is public only once approved.
     */
    @Transactional
    public Created<MerchantVideoDto> attach(long productId, VideoAttachRequest request) {
        Product product = productService.ownedWritable(productId);
        // A double submit waits here and then finds the video the first request attached.
        productService.lockStore(product);
        String key = request.key().strip();
        Optional<ProductVideo> current = product.getVideo();
        if (current.isPresent() && current.get().storageKey().equals(key)) {
            return new Created<>(views.video(current.get()), false);
        }
        if (!keyPattern(product).matcher(key).matches()) {
            throw invalid("merchant.video_key", "key");
        }
        requireQuota(product);
        Instant now = clock.instant();
        ImageUploadSlot slot = slots.findByStorageKey(key)
                .filter(s -> s.getProductId() == product.getId() && s.getKind() == ImageUploadKind.VIDEO && s.isOpen()
                        && now.isBefore(s.getExpiresAt().plus(MerchantImageService.ATTACH_GRACE)))
                .orElseThrow(() -> invalid("merchant.video_missing", "key"));
        StoredObject stored = storage.headStaged(key).orElseThrow(() -> invalid("merchant.video_missing", "key"));
        if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MAX_BYTES) {
            refuse(slot, key, now);
            throw invalid("merchant.video_size", "key");
        }
        VideoInfo info = check(slot, key, stored, now);
        ProductVideo video = new ProductVideo(key, info.contentType(), stored.sizeBytes(), (int) info.durationMs(),
                info.width(), info.height(), request.isAiGenerated());
        if (current.isPresent()) {
            discardAfterCommit(current.get().storageKey());
        }
        product.setVideo(video);
        slot.attached(now);
        productService.afterChange(product, true, now);
        productService.flush();
        audit.record("VIDEO_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"durationMs\":" + video.durationMs() + ",\"sizeBytes\":" + video.sizeBytes() + ",\"aiGenerated\":"
                        + video.aiGenerated() + ",\"replaced\":" + current.isPresent() + "}");
        publish(key, stored);
        return new Created<>(views.video(video), true);
    }

    /** Removes the video and, after the commit, its file: 404 when the product has none. */
    @Transactional
    public void remove(long productId) {
        Product product = productService.ownedWritable(productId);
        ProductVideo video = product.getVideo().orElseThrow(ApiException::notFound);
        product.removeVideo();
        productService.flush();
        audit.record("VIDEO_REMOVED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null, null);
        discardAfterCommit(video.storageKey());
    }

    /** The store's other live products may hold at most {@code maxPerStore - 1} videos for this one to get one. */
    private void requireQuota(Product product) {
        if (products.countVideosOfStore(product.getStore().getId(), product.getId()) >= properties.maxPerStore()) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.video_quota");
        }
    }

    /**
     * Reads the staged file (it is at most 8 MB; the index of an MP4 is often at its end) and checks its
     * container: the type its key names, with a duration the header states and within the limit. A file that
     * fails is deleted.
     */
    private VideoInfo check(ImageUploadSlot slot, String key, StoredObject stored, Instant now) {
        String expected = key.endsWith(".webm") ? VideoProbe.WEBM : VideoProbe.MP4;
        Optional<VideoInfo> info;
        try {
            info = VideoProbe.probe(storage.readStagedStart(key, stored, (int) stored.sizeBytes()));
        } catch (StagedUploadChangedException e) {
            throw changedAfterCheck(key);
        }
        if (info.isEmpty() || !info.get().contentType().equals(expected)) {
            refuse(slot, key, now);
            throw invalid("merchant.video_type", "key");
        }
        if (info.get().durationMs() <= 0 || info.get().durationMs() > MAX_DURATION_MS) {
            refuse(slot, key, now);
            throw invalid("merchant.video_duration", "key");
        }
        return info.get();
    }

    /**
     * A staged file that failed its check: it is deleted and its upload is closed in a transaction of its own
     * (the refusal rolls this one back), so a seller who picked the wrong file can try again at once instead of
     * waiting for the open uploads to expire.
     */
    private void refuse(ImageUploadSlot slot, String key, Instant now) {
        discardStaged(key);
        try {
            ownTransaction.executeWithoutResult(status -> slots.markDiscarded(List.of(slot.getId()), now));
        } catch (RuntimeException e) {
            log.warn("Could not close the refused upload {}: {}", key, e.toString());
        }
    }

    /** Copies the checked object to the public bucket; call after the rows are written and flushed. */
    private void publish(String key, StoredObject stored) {
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
        // Public only now, after the check and the row, and only the object that was checked (#158).
        try {
            storage.publishStaged(key, stored);
        } catch (StagedUploadChangedException e) {
            throw changedAfterCheck(key);
        }
    }

    private void discardAfterCommit(String key) {
        if (key.startsWith("demo/")) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                discard(key);
            }
        });
    }

    /** The staged file was PUT again or removed after its check: it is deleted and never published (#158). */
    private ApiException changedAfterCheck(String key) {
        log.info("Staged video {} changed after its check", key);
        discardStaged(key);
        return invalid("merchant.video_missing", "key");
    }

    /** Keys are generated by {@link #upload}: {@code products/<store>/<product>/video/<uuid>.<ext>}. */
    private static String prefix(Product product) {
        return "products/" + product.getStore().getId() + "/" + product.getId() + "/video/";
    }

    private static Pattern keyPattern(Product product) {
        return Pattern.compile(Pattern.quote(prefix(product)) + FILE_NAME);
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
}
