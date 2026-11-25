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
import az.jeparla.merchant.dto.EvidenceAttachRequest;
import az.jeparla.merchant.dto.ImageAttachRequest;
import az.jeparla.merchant.dto.ImageOrderRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import az.jeparla.merchant.dto.MerchantEvidencePhotoDto;
import az.jeparla.merchant.dto.MerchantImageDto;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.product.EvidenceKind;
import az.jeparla.product.FirstOriginalPhotoAttached;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Product;
import az.jeparla.product.ProductEvidencePhoto;
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
import org.springframework.security.access.AccessDeniedException;
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
    /** Open uploads per product and evidence kind; the product keeps one photo of each kind (#106). */
    public static final int MAX_OPEN_EVIDENCE_UPLOADS = 3;
    private static final String FILE_NAME = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)";
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
    private final ProductDraftRepository drafts;

    public MerchantImageService(MerchantProducts productService, ImageUploadSlotRepository slots,
            ObjectStorage storage, MerchantViews views, AuditService audit, MerchantImageProperties properties,
            Clock clock, ApplicationEventPublisher events, ProductDraftRepository drafts) {
        this.events = events;
        this.drafts = drafts;
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
        String extension = extension(request);
        // Requests of one store count one after another: two at once cannot both take the last place.
        productService.lockStore(product);
        Instant now = clock.instant();
        if (product.getImages().size() + slots.countOpen(product.getId(), ImageUploadKind.GALLERY, now) >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.image_limit");
        }
        return presign(product, ImageUploadKind.GALLERY, prefix(product), extension, request, now);
    }

    /**
     * A presigned upload for the hallmark or label photo of the product (#106): the same type, size and daily
     * checks as a gallery photo, 409 {@code merchant.evidence_upload_limit} with
     * {@value #MAX_OPEN_EVIDENCE_UPLOADS} open uploads of that kind, 409 {@code merchant.hallmark_precious_only}
     * for a hallmark of a FASHION product.
     */
    @Transactional
    public ImageUploadDto uploadEvidence(long productId, EvidenceKind kind, ImageUploadRequest request) {
        Product product = productService.ownedWritable(productId);
        requireEvidenceAllowed(product, kind);
        String extension = extension(request);
        productService.lockStore(product);
        Instant now = clock.instant();
        ImageUploadKind uploadKind = ImageUploadKind.of(kind);
        if (slots.countOpen(product.getId(), uploadKind, now) >= MAX_OPEN_EVIDENCE_UPLOADS) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.evidence_upload_limit");
        }
        return presign(product, uploadKind, evidencePrefix(product), extension, request, now);
    }

    private static String extension(ImageUploadRequest request) {
        String extension = EXTENSIONS.get(request.contentType().strip().toLowerCase(Locale.ROOT));
        if (extension == null) {
            throw invalid("merchant.image_type", "contentType");
        }
        if (request.sizeBytes() > MAX_BYTES) {
            throw invalid("merchant.image_size", "sizeBytes");
        }
        return extension;
    }

    /** The daily limit of the store, then a slot and a presigned PUT under {@code prefix}. Store row locked. */
    private ImageUploadDto presign(Product product, ImageUploadKind kind, String prefix, String extension,
            ImageUploadRequest request, Instant now) {
        String type = request.contentType().strip().toLowerCase(Locale.ROOT);
        long storeId = product.getStore().getId();
        Instant dayAgo = now.minus(DAILY_WINDOW);
        if (slots.countByStoreIdAndCreatedAtAfter(storeId, dayAgo) >= properties.dailyUploadsPerStore()) {
            Instant oldest = slots.findFirstByStoreIdAndCreatedAtAfterOrderByCreatedAtAsc(storeId, dayAgo)
                    .map(ImageUploadSlot::getCreatedAt).orElse(now);
            log.info("Daily photo upload limit reached by store {}", storeId);
            throw new RateLimitExceededException(
                    Math.max(1, Duration.between(now, oldest.plus(DAILY_WINDOW)).toSeconds() + 1));
        }
        String key = prefix + UUID.randomUUID() + "." + extension;
        Instant expiresAt = now.plus(UPLOAD_TTL);
        slots.save(new ImageUploadSlot(key, product.getId(), storeId, kind, now, expiresAt));
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
        Checked checked = checkStaged(product, key, ImageUploadKind.GALLERY, now);
        int sortOrder = product.getImages().stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        ProductImage image = new ProductImage(key, checked.width(), checked.height(), checked.contentType(),
                checked.stored().sizeBytes(), request.isAiGenerated(), sortOrder);
        String altAz = blankToNull(request.altAz());
        if (altAz != null || blankToNull(request.altEn()) != null || blankToNull(request.altRu()) != null) {
            image.setAlt(LocalizedText.of(altAz != null ? altAz : product.getName().az(), blankToNull(request.altEn()),
                    blankToNull(request.altRu())));
        }
        product.addImage(image);
        checked.slot().attached(now);
        productService.afterChange(product, true, now);
        productService.flush();
        if (!image.isAiGenerated() && originals(product) == 1) {
            events.publishEvent(
                    new FirstOriginalPhotoAttached(product.getId(), image.getId(), request.tryOnModelId()));
        }
        audit.record("IMAGE_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"imageId\":" + image.getId() + ",\"aiGenerated\":" + image.isAiGenerated() + "}");
        publish(key, checked.stored());
        return new Created<>(views.image(image), true);
    }

    /**
     * Makes the photo of a draft (#109, "create product" from a photo or catalog PDF draft) a photo of the product.
     * The draft photo was checked when the draft was made (size, magic bytes, dimensions) and sits in the private
     * bucket; it is copied to the public bucket only after the rows are written, and the draft and its private file
     * go after the commit. Another store's draft is 403, a missing one 404 (also when it was already used).
     */
    @Transactional
    public Created<MerchantImageDto> attachDraft(long productId, long draftId, String altAz, Long tryOnModelId) {
        Product product = productService.ownedWritable(productId);
        productService.lockStore(product);
        ProductDraft draft = drafts.findById(draftId).orElseThrow(ApiException::notFound);
        if (!draft.getStoreId().equals(product.getStore().getId())) {
            throw new AccessDeniedException("Another store's draft");
        }
        if (product.getImages().size() >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.image_limit");
        }
        String privateKey = draft.getImageKey();
        StoredObject stored = storage.headPrivate(privateKey)
                .orElseThrow(() -> invalid("merchant.image_missing", "draftId"));
        String extension = EXTENSIONS.get(draft.getContentType());
        String publicKey = prefix(product) + UUID.randomUUID() + "." + extension;
        Instant now = clock.instant();
        int sortOrder = product.getImages().stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        ProductImage image = new ProductImage(publicKey, draft.getWidth(), draft.getHeight(), draft.getContentType(),
                stored.sizeBytes(), false, sortOrder);
        String alt = blankToNull(altAz);
        if (alt != null) {
            image.setAlt(LocalizedText.of(alt, null, null));
        }
        product.addImage(image);
        drafts.delete(draft);
        productService.afterChange(product, true, now);
        productService.flush();
        if (originals(product) == 1) {
            events.publishEvent(new FirstOriginalPhotoAttached(product.getId(), image.getId(), tryOnModelId));
        }
        audit.record("IMAGE_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"imageId\":" + image.getId() + ",\"aiGenerated\":false,\"draftId\":" + draftId + "}");
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) {
                    discardPrivate(privateKey);
                } else {
                    discard(publicKey);
                }
            }
        });
        // Public only now, after the rows; a rollback removes the copy again.
        storage.publishPrivate(privateKey, publicKey);
        return new Created<>(views.image(image), true);
    }

    /**
     * Sets the hallmark or label photo of the product (#106) from an upload of {@link #uploadEvidence}, with the
     * same checks as a gallery photo. A photo of that kind the product had is replaced (its file is deleted after
     * the commit); the new one waits for an admin check (PENDING). Setting the same key again returns the photo it
     * already is. A new photo on an APPROVED product sends it back to review, so it is public only once approved.
     */
    @Transactional
    public Created<MerchantEvidencePhotoDto> attachEvidence(long productId, EvidenceKind kind,
            EvidenceAttachRequest request) {
        Product product = productService.ownedWritable(productId);
        requireEvidenceAllowed(product, kind);
        productService.lockStore(product);
        String key = request.key().strip();
        Optional<ProductEvidencePhoto> current = product.evidencePhoto(kind);
        if (current.isPresent() && current.get().getStorageKey().equals(key)) {
            return new Created<>(views.evidence(current.get()), false);
        }
        if (!evidenceKeyPattern(product).matcher(key).matches()) {
            throw invalid("merchant.image_key", "key");
        }
        Instant now = clock.instant();
        Checked checked = checkStaged(product, key, ImageUploadKind.of(kind), now);
        Long replaced = null;
        if (current.isPresent()) {
            replaced = current.get().getId();
            product.removeEvidencePhoto(current.get());
            discardAfterCommit(current.get().getStorageKey());
            // The unique (product, kind) index: the old row goes before the new one is inserted.
            productService.flush();
        }
        ProductEvidencePhoto photo = new ProductEvidencePhoto(kind, key, checked.width(), checked.height(),
                checked.contentType(), checked.stored().sizeBytes());
        product.addEvidencePhoto(photo);
        checked.slot().attached(now);
        productService.afterChange(product, true, now);
        productService.flush();
        audit.record("EVIDENCE_PHOTO_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"photoId\":" + photo.getId() + ",\"kind\":\"" + kind + "\""
                        + (replaced == null ? "" : ",\"replacedPhotoId\":" + replaced) + "}");
        publish(key, checked.stored());
        return new Created<>(views.evidence(photo), true);
    }

    /** Removes the hallmark or label photo and, after the commit, its file: 404 when the product has none. */
    @Transactional
    public void removeEvidence(long productId, EvidenceKind kind) {
        Product product = productService.ownedWritable(productId);
        ProductEvidencePhoto photo = product.evidencePhoto(kind).orElseThrow(ApiException::notFound);
        String key = photo.getStorageKey();
        long photoId = photo.getId();
        product.removeEvidencePhoto(photo);
        productService.flush();
        audit.record("EVIDENCE_PHOTO_REMOVED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"photoId\":" + photoId + ",\"kind\":\"" + kind + "\"}");
        discardAfterCommit(key);
    }

    /**
     * A hallmark is the assay stamp of a precious metal: a FASHION product (#128) has none to show, so only its
     * label may be added.
     */
    private static void requireEvidenceAllowed(Product product, EvidenceKind kind) {
        if (kind == EvidenceKind.HALLMARK && product.getMaterialKind() == MaterialKind.FASHION) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.hallmark_precious_only");
        }
    }

    /** What the check of a staged upload found. */
    private record Checked(ImageUploadSlot slot, StoredObject stored, String contentType, int width, int height) {
    }

    /**
     * Checks the staged object behind {@code key}: an open upload of {@code kind} for this product, not too old,
     * present, within the size limit, and a JPEG, PNG or WebP of the type its key names (magic numbers) within
     * the dimension limit. A file that fails is deleted.
     */
    private Checked checkStaged(Product product, String key, ImageUploadKind kind, Instant now) {
        ImageUploadSlot slot = slots.findByStorageKey(key)
                .filter(s -> s.getProductId() == product.getId() && s.getKind() == kind && s.isOpen()
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
        return new Checked(slot, stored, expected, info.get().width(), info.get().height());
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
        // Public only now, after the check and the rows, and only the object that was checked (#158).
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
        return Pattern.compile(Pattern.quote(prefix(product)) + FILE_NAME);
    }

    /** Evidence photos (#106): {@code products/<store>/<product>/evidence/<uuid>.<ext>}. */
    private static String evidencePrefix(Product product) {
        return prefix(product) + "evidence/";
    }

    private static Pattern evidenceKeyPattern(Product product) {
        return Pattern.compile(Pattern.quote(evidencePrefix(product)) + FILE_NAME);
    }

    /** Best effort: a public file left behind is only storage, never shown (no row points at it). */
    private void discard(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete stored object {}: {}", key, e.toString());
        }
    }

    /** Best effort: a private draft file left behind is never shown (no row points at it). */
    private void discardPrivate(String key) {
        try {
            storage.deletePrivate(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete private object {}: {}", key, e.toString());
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
