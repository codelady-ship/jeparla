package az.jeparla.ai;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.ai.dto.AiModelImageAttachRequest;
import az.jeparla.ai.dto.AiModelRequest;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageProbe.ImageInfo;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedUpload;
import az.jeparla.common.storage.ObjectStorage.StoredObject;
import az.jeparla.common.storage.StagedUploadChangedException;
import az.jeparla.merchant.MerchantImageService;
import az.jeparla.merchant.dto.ImageUploadDto;
import az.jeparla.merchant.dto.ImageUploadRequest;
import az.jeparla.product.Audience;
import java.time.Clock;
import java.time.Duration;
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
 * The AI model library (#130), ADMIN only, every change audited. Reference photos are uploaded by the admin
 * (presigned PUT into the private staging area, then the same magic-number check as product photos and a copy to
 * the public bucket); the API never generates a model. A model is never deleted: deactivated, it disappears from
 * new jobs while images approved earlier stay. Staged files that are never attached are removed by the private
 * bucket's lifecycle rule on {@code staging/} (backend/README.md).
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiModelService {

    private static final Logger log = LoggerFactory.getLogger(AdminAiModelService.class);

    /** Reference photos per model: a pose set (hand, ear, neck, wrist, half portrait) with a few spares. */
    public static final int MAX_IMAGES = 12;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(10);
    private static final Map<String, String> EXTENSIONS =
            Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private final AiModelRepository models;
    private final AiModelViews views;
    private final ObjectStorage storage;
    private final AuditService audit;
    private final Clock clock;

    public AdminAiModelService(AiModelRepository models, AiModelViews views, ObjectStorage storage,
            AuditService audit, Clock clock) {
        this.models = models;
        this.views = views;
        this.storage = storage;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AiModelDto> list() {
        return models.findAllByOrderBySortOrderAscIdAsc().stream().map(views::view).toList();
    }

    @Transactional
    public AiModelDto create(AiModelRequest request) {
        requireModelAudience(request.audience());
        AiModel model = models.save(new AiModel(request.name().strip(), request.audience(), request.skinTone(),
                request.style(), request.origin().strip(), request.sortOrder() == null ? 0 : request.sortOrder(),
                clock.instant()));
        models.flush();
        audit.record("AI_MODEL_CREATED", AuditTargetType.CATALOG, model.getId(), model.getName(), null, null);
        return views.view(model);
    }

    @Transactional
    public AiModelDto update(long id, AiModelRequest request) {
        requireModelAudience(request.audience());
        AiModel model = models.findById(id).orElseThrow(ApiException::notFound);
        boolean wasActive = model.isActive();
        if (model.isDefault() && model.getAudience() != request.audience()) {
            model.setDefault(false, clock.instant());
        }
        model.change(request.name().strip(), request.audience(), request.skinTone(), request.style(),
                request.origin().strip(), request.sortOrder() == null ? model.getSortOrder() : request.sortOrder(),
                request.active() == null ? model.isActive() : request.active(), clock.instant());
        models.flush();
        String action = wasActive && !model.isActive() ? "AI_MODEL_DEACTIVATED" : "AI_MODEL_CHANGED";
        audit.record(action, AuditTargetType.CATALOG, model.getId(), model.getName(), null, null);
        return views.view(model);
    }

    /** The model becomes the default of its audience (the previous one stops being it). 409 when inactive. */
    @Transactional
    public AiModelDto makeDefault(long id) {
        AiModel model = models.findById(id).orElseThrow(ApiException::notFound);
        if (!model.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.model_inactive");
        }
        models.clearDefault(model.getAudience());
        AiModel reloaded = models.findById(id).orElseThrow(ApiException::notFound);
        reloaded.setDefault(true, clock.instant());
        models.flush();
        audit.record("AI_MODEL_DEFAULT", AuditTargetType.CATALOG, reloaded.getId(), reloaded.getName(), null, null);
        return views.view(reloaded);
    }

    /** A presigned upload for one reference photo (JPEG, PNG or WebP, up to 15 MB). */
    @Transactional(readOnly = true)
    public ImageUploadDto upload(long id, ImageUploadRequest request) {
        AiModel model = models.findById(id).orElseThrow(ApiException::notFound);
        String type = request.contentType().strip().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(type);
        if (extension == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_type", "contentType");
        }
        if (request.sizeBytes() > MerchantImageService.MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_size", "sizeBytes");
        }
        if (model.getImages().size() >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.model_image_limit");
        }
        String key = prefix(model.getId()) + UUID.randomUUID() + "." + extension;
        PresignedUpload upload = storage.presignStagedUpload(key, type, request.sizeBytes(), UPLOAD_TTL);
        return new ImageUploadDto(key, upload.url(), upload.method(), upload.headers(), upload.expiresAt(),
                MerchantImageService.MAX_BYTES);
    }

    /** Checks the staged file (size, magic number, dimensions) and publishes it as a reference photo. */
    @Transactional
    public AiModelDto attach(long id, AiModelImageAttachRequest request) {
        AiModel model = models.findById(id).orElseThrow(ApiException::notFound);
        String key = request.key().strip();
        Optional<AiModelImage> attached = model.getImages().stream()
                .filter(image -> image.getStorageKey().equals(key)).findFirst();
        if (attached.isPresent()) {
            return views.view(model);
        }
        if (!keyPattern(model.getId()).matcher(key).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_key", "key");
        }
        if (model.getImages().size() >= MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.model_image_limit");
        }
        StoredObject stored = storage.headStaged(key)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_missing", "key"));
        if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MerchantImageService.MAX_BYTES) {
            discardStaged(key);
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_size", "key");
        }
        String expected = EXTENSIONS.entrySet().stream().filter(e -> key.endsWith("." + e.getValue()))
                .map(Map.Entry::getKey).findFirst().orElseThrow();
        Optional<ImageInfo> info;
        try {
            info = ImageProbe.probe(storage.readStagedStart(key, stored, ImageProbe.HEADER_BYTES));
        } catch (StagedUploadChangedException e) {
            discardStaged(key);
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_missing", "key");
        }
        if (info.isEmpty() || !info.get().contentType().equals(expected)) {
            discardStaged(key);
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_type", "key");
        }
        if (info.get().width() > MerchantImageService.MAX_SIDE || info.get().height() > MerchantImageService.MAX_SIDE) {
            discardStaged(key);
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_dimensions", "key");
        }
        int sortOrder = model.getImages().stream().mapToInt(AiModelImage::getSortOrder).max().orElse(-1) + 1;
        AiModelImage image = new AiModelImage(key, request.pose(), expected, info.get().width(), info.get().height(),
                stored.sizeBytes(), sortOrder);
        model.addImage(image);
        models.flush();
        audit.record("AI_MODEL_IMAGE_ADDED", AuditTargetType.CATALOG, model.getId(), model.getName(), null,
                "{\"imageId\":" + image.getId() + ",\"pose\":\"" + image.getPose() + "\"}");
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deletePublic(key);
                }
            }
        });
        try {
            storage.publishStaged(key, stored);
        } catch (StagedUploadChangedException e) {
            discardStaged(key);
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.image_missing", "key");
        }
        return views.view(model);
    }

    /** Removes a reference photo; product images approved earlier are separate files and stay. */
    @Transactional
    public AiModelDto removeImage(long id, long imageId) {
        AiModel model = models.findById(id).orElseThrow(ApiException::notFound);
        AiModelImage image = model.getImages().stream().filter(i -> i.getId() == imageId).findFirst()
                .orElseThrow(ApiException::notFound);
        String key = image.getStorageKey();
        model.removeImage(image);
        models.flush();
        audit.record("AI_MODEL_IMAGE_REMOVED", AuditTargetType.CATALOG, model.getId(), model.getName(), null,
                "{\"imageId\":" + imageId + "}");
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deletePublic(key);
            }
        });
        return views.view(model);
    }

    private static void requireModelAudience(Audience audience) {
        if (audience == Audience.UNISEX) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.model_audience", "audience");
        }
    }

    private static String prefix(long modelId) {
        return "ai-models/" + modelId + "/";
    }

    private static Pattern keyPattern(long modelId) {
        return Pattern.compile(Pattern.quote(prefix(modelId))
                + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)");
    }

    private void discardStaged(String key) {
        try {
            storage.deleteStaged(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete staged upload {}: {}", key, e.toString());
        }
    }

    private void deletePublic(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete stored object {}: {}", key, e.toString());
        }
    }
}
