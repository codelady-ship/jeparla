package az.jeparla.ai;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.ai.dto.AiAssetDto;
import az.jeparla.ai.dto.AiJobDto;
import az.jeparla.ai.dto.AiJobRequest;
import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.ai.dto.AiStatusDto;
import az.jeparla.ai.provider.ImageGenerationException;
import az.jeparla.ai.provider.ImageGenerationProvider;
import az.jeparla.ai.provider.ImageGenerationProviders;
import az.jeparla.auth.CurrentUser;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.merchant.Created;
import az.jeparla.merchant.MerchantImageService;
import az.jeparla.merchant.MerchantProducts;
import az.jeparla.product.Audience;
import az.jeparla.product.AudienceRules;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.store.StoreRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * AI Studio for sellers (#55, PLAN 5.12, 5.13). A job is made from one original photo of the seller's own
 * product; the provider runs later in {@link AiJobWorker}. Nothing generated is public until the seller approves
 * one result: then it is copied to the public bucket as a <b>new</b> product photo with {@code aiGenerated=true}
 * (the "AI ilə yaradılıb" badge), after the original photos, and an APPROVED product goes back to review. The
 * original photo is never changed.
 *
 * <p>Limits: the rate-limit policy {@code ai-job-account} per seller (controller), {@link
 * AiProperties#dailyJobsPerStore} jobs and retries per store and day (429 with {@code Retry-After}),
 * {@link AiProperties#maxAttempts} attempts per job, and the monthly hard cost limit of all stores (503
 * {@code ai.cost_limit}). With no provider configured every request answers 503 {@code ai.not_configured}.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class AiStudioService {

    private static final Logger log = LoggerFactory.getLogger(AiStudioService.class);

    private final MerchantProducts products;
    private final AiJobRepository jobs;
    private final AiAssetRepository assets;
    private final AiApprovalRepository approvals;
    private final AiUsage usage;
    private final ImageGenerationProviders providers;
    private final ObjectStorage storage;
    private final StoreRepository stores;
    private final AuditService audit;
    private final AiProperties properties;
    private final Clock clock;
    private final AiModelCatalog modelCatalog;

    public AiStudioService(MerchantProducts products, AiJobRepository jobs, AiAssetRepository assets,
            AiApprovalRepository approvals, AiUsage usage, ImageGenerationProviders providers, ObjectStorage storage,
            StoreRepository stores, AuditService audit, AiProperties properties, Clock clock,
            AiModelCatalog modelCatalog) {
        this.products = products;
        this.jobs = jobs;
        this.assets = assets;
        this.approvals = approvals;
        this.usage = usage;
        this.providers = providers;
        this.storage = storage;
        this.stores = stores;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
        this.modelCatalog = modelCatalog;
    }

    /** Whether AI Studio is on, and the quota of the seller's store today. */
    @Transactional(readOnly = true)
    public AiStatusDto status() {
        ImageGenerationProvider provider = providers.active();
        int used = stores.findByOwnerId(CurrentUser.id()).map(store -> usage.attempts(store.getId(), today()))
                .orElse(0);
        return new AiStatusDto(provider.configured(), provider.id(), properties.dailyJobsPerStore(), used,
                properties.maxAttempts());
    }

    /**
     * Queues a job. 503 {@code ai.not_configured} without a provider, 400 for a photo of another product or an
     * AI-generated photo, 429 over the daily quota, 503 {@code ai.cost_limit} when the month's budget is spent.
     * The same Idempotency-Key returns the job it created before.
     */
    @Transactional
    public Created<AiJobDto> create(AiJobRequest request, UUID idempotencyKey) {
        Product product = products.ownedWritable(request.productId());
        // Jobs of one store are queued one after another: two requests cannot both take the last place.
        products.lockStore(product);
        long storeId = product.getStore().getId();
        if (idempotencyKey != null) {
            var existing = jobs.findByStoreIdAndIdempotencyKey(storeId, idempotencyKey);
            if (existing.isPresent()) {
                return new Created<>(view(existing.get()), false);
            }
        }
        ProductImage source = product.getImages().stream()
                .filter(image -> image.getId().equals(request.sourceImageId())).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "ai.source_image", "sourceImageId"));
        if (source.isAiGenerated()) {
            // Generating from a generated image drifts away from the real item.
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.source_ai_generated", "sourceImageId");
        }
        Long modelId = modelCatalog.checkForJob(request.kind(), request.modelId(), product.getAudience());
        requireAvailable(storeId);
        Instant now = clock.instant();
        AiJob job = new AiJob(storeId, product.getId(), source.getId(), request.kind(), properties.maxAttempts(),
                idempotencyKey, CurrentUser.id(), now);
        job.useModel(modelId);
        job = jobs.save(job);
        jobs.flush();
        audit.record("AI_JOB_CREATED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"jobId\":" + job.getId() + ",\"kind\":\"" + job.getKind() + "\"}");
        return new Created<>(view(job), true);
    }

    /**
     * AI models of the library a seller can pick (#130), the default first; {@code audience} null for all. With
     * {@code productId} (an own product) only the models that fit its audience (#121): a KIDS piece only on a child.
     */
    @Transactional(readOnly = true)
    public List<AiModelDto> models(Audience audience, Long productId) {
        if (productId == null) {
            return modelCatalog.selectable(audience);
        }
        Audience product = products.owned(productId).getAudience();
        return modelCatalog.selectable(audience).stream()
                .filter(model -> AudienceRules.fits(product, model.audience())).toList();
    }

    /** The product's jobs, newest first (at most 50). */
    @Transactional(readOnly = true)
    public List<AiJobDto> list(long productId) {
        Product product = products.owned(productId);
        List<AiJob> found = jobs.findTop50ByProductIdOrderByCreatedAtDescIdDesc(product.getId());
        Map<Long, List<AiAsset>> byJob = found.isEmpty() ? Map.of()
                : assets.findByJobIdInOrderByIdAsc(found.stream().map(AiJob::getId).toList()).stream()
                        .collect(Collectors.groupingBy(AiAsset::getJobId));
        return found.stream().map(job -> view(job, byJob.getOrDefault(job.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public AiJobDto get(long jobId) {
        AiJob job = jobs.findById(jobId).orElseThrow(ApiException::notFound);
        products.owned(job.getProductId());
        return view(job);
    }

    /**
     * Publishes one result as a new product photo (aiGenerated). 409 {@code ai.job_state} unless the job waits
     * for review, 409 {@code merchant.image_limit} when the product has 8 photos.
     */
    @Transactional
    public AiJobDto approve(long jobId, long assetId) {
        AiJob job = jobs.findById(jobId).orElseThrow(ApiException::notFound);
        Product product = products.ownedWritable(job.getProductId());
        products.lockStore(product);
        if (job.getStatus() != AiJobStatus.REVIEW_REQUIRED) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.job_state");
        }
        List<AiAsset> results = assets.findByJobIdOrderByIdAsc(job.getId());
        AiAsset chosen = results.stream().filter(a -> a.getId() == assetId && a.getStorageKey() != null).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "ai.asset", "assetId"));
        if (product.getImages().size() >= MerchantImageService.MAX_IMAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.image_limit");
        }
        Instant now = clock.instant();
        String publicKey = "products/" + product.getStore().getId() + "/" + product.getId() + "/" + UUID.randomUUID()
                + "." + extension(chosen.getContentType());
        int sortOrder = product.getImages().stream().mapToInt(ProductImage::getSortOrder).max().orElse(-1) + 1;
        ProductImage image = new ProductImage(publicKey, chosen.getWidth(), chosen.getHeight(),
                chosen.getContentType(), chosen.getSizeBytes(), true, sortOrder);
        image.setAlt(LocalizedText.of(product.getName().az(), null, null));
        product.addImage(image);
        products.afterChange(product, true, now);
        products.flush();
        chosen.becameProductImage(image.getId());
        approvals.save(AiApproval.approved(job.getId(), chosen.getId(), CurrentUser.id()));
        job.approve(now);
        audit.record("AI_RESULT_APPROVED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"jobId\":" + job.getId() + ",\"imageId\":" + image.getId() + "}");
        String chosenKey = chosen.getStorageKey();
        List<String> privateKeys = forgetFiles(results);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_COMMITTED) {
                    privateKeys.forEach(AiStudioService.this::deletePrivate);
                } else {
                    deletePublic(publicKey);
                }
            }
        });
        // Public only now, after the rows; a rollback removes the copy again.
        storage.publishPrivate(chosenKey, publicKey);
        return view(job, results);
    }

    /** The seller does not want any result: the job is CANCELLED and its files are deleted. */
    @Transactional
    public AiJobDto reject(long jobId) {
        AiJob job = jobs.findById(jobId).orElseThrow(ApiException::notFound);
        products.ownedWritable(job.getProductId());
        if (job.getStatus() != AiJobStatus.REVIEW_REQUIRED) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.job_state");
        }
        job.cancel(clock.instant());
        approvals.save(AiApproval.rejected(job.getId(), CurrentUser.id()));
        List<AiAsset> results = assets.findByJobIdOrderByIdAsc(job.getId());
        deleteAfterCommit(forgetFiles(results));
        return view(job, results);
    }

    /** Queues a FAILED job again (counts against the daily quota); 409 when no attempts are left. */
    @Transactional
    public AiJobDto retry(long jobId) {
        AiJob job = jobs.findById(jobId).orElseThrow(ApiException::notFound);
        Product product = products.ownedWritable(job.getProductId());
        products.lockStore(product);
        if (job.getStatus() != AiJobStatus.FAILED) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.job_state");
        }
        if (!job.canRetry()) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.no_attempts_left");
        }
        requireAvailable(job.getStoreId());
        job.retry(clock.instant());
        return view(job);
    }

    /**
     * Cancels a job that is not running and deletes its unapproved files; the row stays for the usage history.
     * Repeating it is a no-op. 409 while PROCESSING or once APPROVED (remove the photo instead).
     */
    @Transactional
    public void delete(long jobId) {
        AiJob job = jobs.findById(jobId).orElseThrow(ApiException::notFound);
        products.ownedWritable(job.getProductId());
        if (job.getStatus() == AiJobStatus.CANCELLED) {
            return;
        }
        job.cancel(clock.instant());
        deleteAfterCommit(forgetFiles(assets.findByJobIdOrderByIdAsc(job.getId())));
    }

    /** Provider on, quota left, budget left; counts one attempt of the store today. */
    private void requireAvailable(long storeId) {
        if (!providers.active().configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ImageGenerationException.NOT_CONFIGURED);
        }
        LocalDate today = today();
        if (usage.attempts(storeId, today) >= properties.dailyJobsPerStore()) {
            ZonedDateTime midnight = today.plusDays(1).atStartOfDay(properties.zone());
            throw new RateLimitExceededException(
                    Math.max(1, Duration.between(clock.instant(), midnight.toInstant()).toSeconds()));
        }
        if (usage.monthCost(YearMonth.from(today)).compareTo(properties.monthlyCostLimit()) >= 0) {
            log.warn("AI Studio monthly cost limit reached");
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ImageGenerationCodes.COST_LIMIT);
        }
        usage.addAttempt(storeId, today, properties.costCurrency());
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), properties.zone());
    }

    private AiJobDto view(AiJob job) {
        return view(job, assets.findByJobIdOrderByIdAsc(job.getId()));
    }

    private AiJobDto view(AiJob job, List<AiAsset> results) {
        List<AiAssetDto> dtos = new ArrayList<>();
        for (AiAsset asset : results) {
            String preview = null;
            if (asset.getStorageKey() != null && job.getStatus() == AiJobStatus.REVIEW_REQUIRED) {
                preview = storage.presignPrivateDownload(asset.getStorageKey(), asset.getContentType(),
                        "ai-result-" + asset.getId() + "." + extension(asset.getContentType()),
                        properties.resultUrlTtl()).url();
            }
            dtos.add(new AiAssetDto(asset.getId(), preview, asset.getWidth(), asset.getHeight(),
                    asset.getProductImageId()));
        }
        return new AiJobDto(job.getId(), job.getProductId(), job.getSourceImageId(), job.getKind(), job.getModelId(),
                job.getStatus(),
                job.getAttempts(), job.getMaxAttempts(), job.getErrorCode(), job.canRetry(), job.getCreatedAt(),
                job.getUpdatedAt(), dtos);
    }

    /** Clears the keys of the job's private files and returns them, to delete after the commit. */
    private static List<String> forgetFiles(List<AiAsset> results) {
        List<String> keys = new ArrayList<>();
        for (AiAsset asset : results) {
            if (asset.getStorageKey() != null) {
                keys.add(asset.getStorageKey());
                asset.fileDeleted();
            }
        }
        return keys;
    }

    private void deleteAfterCommit(List<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                keys.forEach(AiStudioService.this::deletePrivate);
            }
        });
    }

    static String extension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> throw new IllegalArgumentException("Unexpected content type " + contentType);
        };
    }

    /** Best effort: a private file left behind is never shown (no row points at it). */
    private void deletePrivate(String key) {
        try {
            storage.deletePrivate(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete AI result {}: {}", key, e.toString());
        }
    }

    private void deletePublic(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete public copy {}: {}", key, e.toString());
        }
    }
}
