package az.jeparla.search;

import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.search.embedding.ImageEmbeddingProvider;
import az.jeparla.search.embedding.ImageEmbeddingProviders;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import net.javacrumbs.shedlock.core.ClockProvider;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Fills the embeddings of search by photo (#163): every original photo of a listed product without an embedding
 * of the current model gets one, so a newly attached photo is searchable within a run, and switching the model
 * re-embeds the catalog. Idle without a model. One instance at a time (ShedLock).
 */
@Service
public class ImageEmbeddingJob {

    public static final String LOCK_NAME = "image-embeddings";
    static final int BATCH = 20;
    static final int MAX_BATCHES = 25;
    /** Product photos are at most 15 MB (MerchantImageService). */
    static final int MAX_PHOTO_BYTES = 15 * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(ImageEmbeddingJob.class);

    /** What one run did. */
    public record Result(int embedded, int failed) {
    }

    private final ImageEmbeddingProviders providers;
    private final ImageEmbeddings embeddings;
    private final ObjectStorage storage;
    private final LockingTaskExecutor locks;

    public ImageEmbeddingJob(ImageEmbeddingProviders providers, ImageEmbeddings embeddings, ObjectStorage storage,
            LockingTaskExecutor locks) {
        this.providers = providers;
        this.embeddings = embeddings;
        this.storage = storage;
        this.locks = locks;
    }

    @Scheduled(fixedDelayString = "${jeparla.search.image.embed-delay:5m}",
            initialDelayString = "${jeparla.search.image.embed-delay:5m}")
    void scheduled() {
        if (!providers.active().configured()) {
            return;
        }
        runLocked().ifPresent(result -> {
            if (result.embedded() + result.failed() > 0) {
                log.info("Image embeddings: {} photos embedded, {} failed", result.embedded(), result.failed());
            }
        });
    }

    /** One run under the lock; empty when another instance holds it. */
    public Optional<Result> runLocked() {
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME, Duration.ofMinutes(30),
                Duration.ZERO);
        try {
            TaskResult<Result> result = locks.executeWithLock(this::run, lock);
            return result.wasExecuted() ? Optional.ofNullable(result.getResult()) : Optional.empty();
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Image embedding run failed", e);
        }
    }

    Result run() {
        ImageEmbeddingProvider provider = providers.active();
        if (!provider.configured()) {
            return new Result(0, 0);
        }
        int embedded = 0;
        int failed = 0;
        long lastFailed = -1;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            List<ImageEmbeddings.Missing> missing = embeddings.missing(provider.model(), BATCH);
            // A batch made only of photos that failed just now: stop instead of retrying them in a loop.
            if (missing.isEmpty() || missing.getLast().imageId() <= lastFailed) {
                break;
            }
            for (ImageEmbeddings.Missing photo : missing) {
                try {
                    Optional<byte[]> bytes = storage.readPublic(photo.storageKey(), MAX_PHOTO_BYTES);
                    if (bytes.isEmpty()) {
                        failed++;
                        lastFailed = Math.max(lastFailed, photo.imageId());
                        continue;
                    }
                    embeddings.save(photo.imageId(), provider.model(), provider.embed(bytes.get(),
                            photo.contentType()));
                    embedded++;
                } catch (RuntimeException e) {
                    // ImageEmbeddingException included; the message never holds the photo.
                    log.warn("Image embedding of photo {} failed: {}", photo.imageId(), e.toString());
                    failed++;
                    lastFailed = Math.max(lastFailed, photo.imageId());
                }
            }
        }
        return new Result(embedded, failed);
    }
}
