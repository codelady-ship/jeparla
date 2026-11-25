package az.jeparla.ai;

import az.jeparla.ai.provider.GenerationRequest;
import az.jeparla.ai.provider.GenerationResult;
import az.jeparla.ai.provider.ImageGenerationException;
import az.jeparla.ai.provider.ImageGenerationProvider;
import az.jeparla.ai.provider.ImageGenerationProviders;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageProbe.ImageInfo;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.merchant.MerchantImageService;
import az.jeparla.notification.NotificationKind;
import az.jeparla.notification.NotificationService;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.store.Store;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs queued AI Studio jobs (#55). Does nothing while no provider is configured. Each run takes up to
 * {@value #BATCH} jobs one by one: the claim (row lock with SKIP LOCKED, so several instances never run one job),
 * the monthly cost check and the attempt row are one short transaction; the provider call runs outside any
 * transaction; the results are stored in the private bucket and recorded in a second transaction. A job left
 * PROCESSING longer than twice {@link AiProperties#attemptTimeout} (a crash) is marked FAILED. A result that waits
 * for approval tells the seller in that second transaction (#316): an in-app notification, and an email when the
 * account has an address, both linking to the product's AI Studio.
 *
 * <p>No job queues itself again (PLAN 5.13): only the seller's retry does, within the attempt limit.
 */
@Service
public class AiJobWorker {

    static final int BATCH = 5;
    /** Results per attempt. */
    static final int OUTPUTS = 1;

    private static final Logger log = LoggerFactory.getLogger(AiJobWorker.class);

    private final AiJobRepository jobs;
    private final AiJobAttemptRepository attempts;
    private final AiAssetRepository assets;
    private final AiUsage usage;
    private final AiPrompts prompts;
    private final AiJobParameters parameters;
    private final ImageGenerationProviders providers;
    private final ObjectStorage storage;
    private final ImageUrls imageUrls;
    private final EntityManager entityManager;
    private final TransactionTemplate tx;
    private final AiProperties properties;
    private final NotificationService notifications;
    private final Clock clock;

    public AiJobWorker(AiJobRepository jobs, AiJobAttemptRepository attempts, AiAssetRepository assets,
            AiUsage usage, AiPrompts prompts, AiJobParameters parameters, ImageGenerationProviders providers,
            ObjectStorage storage, ImageUrls imageUrls, EntityManager entityManager, TransactionTemplate tx,
            AiProperties properties, NotificationService notifications, Clock clock) {
        this.jobs = jobs;
        this.attempts = attempts;
        this.assets = assets;
        this.usage = usage;
        this.prompts = prompts;
        this.parameters = parameters;
        this.providers = providers;
        this.storage = storage;
        this.imageUrls = imageUrls;
        this.entityManager = entityManager;
        this.tx = tx;
        this.properties = properties;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${jeparla.ai.worker-delay:15s}", initialDelayString = "${jeparla.ai.worker-delay:15s}")
    void scheduled() {
        if (!providers.anyConfigured()) {
            return;
        }
        try {
            run();
        } catch (RuntimeException e) {
            log.warn("AI Studio worker run failed: {}", e.toString());
        }
    }

    /** One run; returns how many jobs it took. */
    public int run() {
        failStuck();
        int taken = 0;
        while (taken < BATCH) {
            Optional<Claimed> claimed = Optional.ofNullable(tx.execute(status -> claim()));
            if (claimed.isEmpty()) {
                break;
            }
            taken++;
            if (claimed.get().request() != null) {
                process(claimed.get());
            }
        }
        return taken;
    }

    /** What the claim transaction hands to the provider call; {@code request} is null when the job failed there. */
    record Claimed(long jobId, long attemptId, long storeId, long productId, BigDecimal estimate,
            GenerationRequest request) {
    }

    private Claimed claim() {
        Optional<Long> id = jobs.claimNextQueued();
        if (id.isEmpty()) {
            return null;
        }
        AiJob job = jobs.findById(id.get()).orElseThrow();
        Instant now = clock.instant();
        ProductImage source = job.getSourceImageId() == null ? null
                : entityManager.find(ProductImage.class, job.getSourceImageId());
        if (source == null) {
            job.fail(ImageGenerationCodes.SOURCE_GONE, now);
            return new Claimed(job.getId(), 0, job.getStoreId(), job.getProductId(), BigDecimal.ZERO, null);
        }
        ImageGenerationProvider provider = providers.forKind(job.getKind().name());
        if (!provider.configured()) {
            // Turned off after the job was queued: it waits as FAILED (retryable) instead of running nowhere.
            job.fail(ImageGenerationException.NOT_CONFIGURED, now);
            return new Claimed(job.getId(), 0, job.getStoreId(), job.getProductId(), BigDecimal.ZERO, null);
        }
        Map<String, String> params = parameters.of(job);
        GenerationRequest request = new GenerationRequest(job.getId(), job.getKind().name(),
                imageUrls.url(source.getStorageKey()), prompts.prompt(job.getKind(), params),
                parameters.referenceImages(job), OUTPUTS, "4:5", params);
        BigDecimal estimate = provider.estimatedCost(request);
        // The hard limit: checked under a lock, so two workers cannot both spend the last of the budget.
        usage.lockCost();
        LocalDate today = LocalDate.ofInstant(now, properties.zone());
        BigDecimal spent = usage.monthCost(YearMonth.from(today));
        if (!provider.local() && spent.add(estimate).compareTo(properties.monthlyCostLimit()) > 0) {
            log.warn("AI Studio monthly cost limit reached: job {} not started", job.getId());
            job.fail(ImageGenerationCodes.COST_LIMIT, now);
            return new Claimed(job.getId(), 0, job.getStoreId(), job.getProductId(), BigDecimal.ZERO, null);
        }
        job.start(now);
        AiJobAttempt attempt = attempts.save(new AiJobAttempt(job.getId(), job.getAttempts(), provider.id(), estimate,
                java.util.Currency.getInstance(properties.costCurrency()), now));
        usage.addCost(job.getStoreId(), today, estimate, properties.costCurrency());
        return new Claimed(job.getId(), attempt.getId(), job.getStoreId(), job.getProductId(), estimate, request);
    }

    private void process(Claimed claimed) {
        GenerationResult result;
        try {
            result = providers.forKind(claimed.request().kind()).generate(claimed.request());
        } catch (ImageGenerationException e) {
            log.info("AI job {} failed at the provider: {}", claimed.jobId(), e.code());
            finishFailed(claimed, ImageGenerationCodes.known(e.code()));
            return;
        } catch (RuntimeException e) {
            log.warn("AI job {} failed at the provider: {}", claimed.jobId(), e.getClass().getSimpleName());
            finishFailed(claimed, ImageGenerationException.PROVIDER_ERROR);
            return;
        }
        List<AiAsset> stored = new ArrayList<>();
        try {
            for (GenerationResult.GeneratedImage image : result.images()) {
                stored.add(store(claimed, image.bytes()));
            }
        } catch (BadResultException e) {
            log.info("AI job {} returned an unusable image", claimed.jobId());
            stored.forEach(asset -> deleteQuietly(asset.getStorageKey()));
            finishFailed(claimed, ImageGenerationCodes.BAD_RESULT);
            return;
        } catch (RuntimeException e) {
            log.warn("AI job {}: could not store the result: {}", claimed.jobId(), e.toString());
            stored.forEach(asset -> deleteQuietly(asset.getStorageKey()));
            finishFailed(claimed, ImageGenerationException.PROVIDER_ERROR);
            return;
        }
        Boolean kept = tx.execute(status -> {
            AiJob job = jobs.findById(claimed.jobId()).orElseThrow();
            if (job.getStatus() != AiJobStatus.PROCESSING) {
                // Marked FAILED as stuck meanwhile: the late result is dropped.
                return false;
            }
            Instant now = clock.instant();
            stored.forEach(assets::save);
            job.resultReady(now);
            notifySeller(job);
            attempts.findById(claimed.attemptId()).ifPresent(a -> a.succeeded(result.cost(), now));
            if (result.cost() != null) {
                usage.addCost(claimed.storeId(), LocalDate.ofInstant(now, properties.zone()),
                        result.cost().subtract(claimed.estimate()), properties.costCurrency());
            }
            return true;
        });
        if (!Boolean.TRUE.equals(kept)) {
            stored.forEach(asset -> deleteQuietly(asset.getStorageKey()));
        }
    }

    /** The store owner learns that a result waits for approval, with a link to the product's AI Studio. */
    private void notifySeller(AiJob job) {
        Store store = entityManager.find(Store.class, job.getStoreId());
        Product product = entityManager.find(Product.class, job.getProductId());
        if (store == null || product == null) {
            return;
        }
        notifications.notify(store.getOwner(), NotificationKind.AI_RESULT_READY,
                locale -> new Object[] {product.getName().in(Language.of(locale))}, null,
                studioLink(job.getProductId()));
    }

    /** Frontend path of a product's AI Studio, where the seller approves or rejects the result. */
    static String studioLink(long productId) {
        return "/merchant/products/" + productId + "/ai-studio";
    }

    /** Checks one generated file (type by magic number, size) and puts it into the private bucket. */
    private AiAsset store(Claimed claimed, byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MerchantImageService.MAX_BYTES) {
            throw new BadResultException();
        }
        ImageInfo info = ImageProbe.probe(bytes).orElseThrow(BadResultException::new);
        if (info.width() > MerchantImageService.MAX_SIDE || info.height() > MerchantImageService.MAX_SIDE) {
            throw new BadResultException();
        }
        String key = "ai/" + claimed.storeId() + "/" + claimed.productId() + "/" + UUID.randomUUID() + "."
                + AiStudioService.extension(info.contentType());
        storage.putPrivate(key, bytes, info.contentType());
        return new AiAsset(claimed.jobId(), key, info.contentType(), info.width(), info.height(), bytes.length,
                providers.forKind(claimed.request().kind()).generative());
    }

    private void finishFailed(Claimed claimed, String code) {
        tx.executeWithoutResult(status -> {
            Instant now = clock.instant();
            jobs.findById(claimed.jobId()).filter(job -> job.getStatus() == AiJobStatus.PROCESSING)
                    .ifPresent(job -> job.fail(code, now));
            attempts.findById(claimed.attemptId()).ifPresent(a -> a.failed(code, now));
        });
    }

    /** Jobs left PROCESSING by a crash become FAILED (retryable). */
    private void failStuck() {
        tx.executeWithoutResult(status -> {
            Instant now = clock.instant();
            for (AiJob job : jobs.findStuck(now.minus(properties.attemptTimeout().multipliedBy(2)))) {
                job.fail(ImageGenerationException.TIMEOUT, now);
                attempts.findFirstByJobIdOrderByNumberDesc(job.getId())
                        .filter(a -> a.getFinishedAt() == null)
                        .ifPresent(a -> a.failed(ImageGenerationException.TIMEOUT, now));
                log.info("AI job {} was stuck in PROCESSING and is marked FAILED", job.getId());
            }
        });
    }

    private void deleteQuietly(String key) {
        try {
            storage.deletePrivate(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete AI result {}: {}", key, e.toString());
        }
    }

    private static final class BadResultException extends RuntimeException {
        BadResultException() {
            super(null, null, false, false);
        }
    }
}
