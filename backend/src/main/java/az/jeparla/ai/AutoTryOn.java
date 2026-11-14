package az.jeparla.ai;

import az.jeparla.ai.dto.AiJobRequest;
import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.FirstOriginalPhotoAttached;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * On-model image by itself (#121): when a product gets its first original photo and {@code jeparla.ai.auto-try-on}
 * is on, a VIRTUAL_TRY_ON job is queued for the seller, with the first library model that fits the product's
 * audience. It runs after the photo's commit in the seller's own request, so ownership, quota, budget and the
 * provider are checked as for a job the seller starts; when any of them says no, nothing is queued and the photo
 * upload is unaffected. The result still waits for the seller's approval.
 */
@Component
class AutoTryOn {

    private static final Logger log = LoggerFactory.getLogger(AutoTryOn.class);

    private final AiStudioService studio;
    private final AiProperties properties;
    private final TransactionTemplate tx;

    AutoTryOn(AiStudioService studio, AiProperties properties, PlatformTransactionManager transactions) {
        this.studio = studio;
        this.properties = properties;
        this.tx = new TransactionTemplate(transactions);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onFirstOriginalPhoto(FirstOriginalPhotoAttached event) {
        if (!properties.autoTryOn() || !studio.status().configured()) {
            return;
        }
        try {
            tx.executeWithoutResult(status -> {
                Long modelId = studio.models(null, event.productId()).stream().findFirst()
                        .map(AiModelDto::id).orElse(null);
                // A fixed key per photo: a repeated event never queues a second job.
                UUID key = UUID.nameUUIDFromBytes(
                        ("auto-try-on:" + event.imageId()).getBytes(StandardCharsets.UTF_8));
                studio.create(new AiJobRequest(event.productId(), event.imageId(), AiJobKind.VIRTUAL_TRY_ON,
                        modelId), key);
            });
        } catch (ApiException e) {
            // Also the quota (RateLimitExceededException is an ApiException), the budget and a missing provider.
            log.info("Automatic on-model image of product {} not queued: {}", event.productId(), e.getMessage());
        }
    }
}
