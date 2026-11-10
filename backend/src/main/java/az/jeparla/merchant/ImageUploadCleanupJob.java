package az.jeparla.merchant;

import az.jeparla.common.storage.ObjectStorage;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import net.javacrumbs.shedlock.core.ClockProvider;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockingTaskExecutor.TaskResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Deletes photo uploads that were never attached (#154): the staged file of every open upload whose URL
 * expired more than {@link #MARGIN} ago (longer than {@link MerchantImageService#ATTACH_GRACE}, so a file
 * being attached is never deleted), then the rows older than {@link #KEEP_ROWS}. Staged files are private,
 * so nothing here was ever public. The private bucket's lifecycle rule on {@code staging/} (one day) is the
 * backstop when this job cannot reach the storage (backend/README.md).
 *
 * <p>Runs from cron ({@code jeparla.merchant.images.cleanup-cron}, every 30 minutes) under the ShedLock lock
 * {@value #LOCK_NAME}, so it runs on one instance at a time. Idempotent: deleting a missing object is a
 * no-op.
 */
@Service
public class ImageUploadCleanupJob {

    public static final String LOCK_NAME = "image-upload-cleanup";
    static final Duration MARGIN = Duration.ofHours(1);
    /** Rows stay longer than the daily limit window of a store. */
    static final Duration KEEP_ROWS = Duration.ofDays(2);
    private static final int BATCH = 200;
    private static final int MAX_BATCHES = 50;

    private static final Logger log = LoggerFactory.getLogger(ImageUploadCleanupJob.class);

    /** What one run did. */
    public record Result(int discarded, int failed, int purged) {
    }

    private final ImageUploadSlotRepository slots;
    private final ObjectStorage storage;
    private final TransactionTemplate tx;
    private final LockingTaskExecutor locks;
    private final MerchantImageProperties properties;
    private final Clock clock;

    public ImageUploadCleanupJob(ImageUploadSlotRepository slots, ObjectStorage storage, TransactionTemplate tx,
            LockingTaskExecutor locks, MerchantImageProperties properties, Clock clock) {
        this.slots = slots;
        this.storage = storage;
        this.tx = tx;
        this.locks = locks;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(cron = "${jeparla.merchant.images.cleanup-cron:0 7/30 * * * *}")
    void scheduled() {
        runLocked().ifPresent(result -> {
            if (result.discarded() + result.failed() + result.purged() > 0) {
                log.info("Upload cleanup: {} staged files deleted, {} failed, {} rows purged", result.discarded(),
                        result.failed(), result.purged());
            }
        });
    }

    /** One run under the lock; empty when another instance holds it. */
    public Optional<Result> runLocked() {
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME,
                properties.cleanupLockAtMostFor(), Duration.ZERO);
        try {
            TaskResult<Result> result = locks.executeWithLock(this::run, lock);
            return result.wasExecuted() ? Optional.ofNullable(result.getResult()) : Optional.empty();
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Upload cleanup failed", e);
        }
    }

    Result run() {
        Instant now = clock.instant();
        int discarded = 0;
        int failed = 0;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            List<ImageUploadSlot> stale = tx.execute(status -> slots.findStale(now.minus(MARGIN),
                    PageRequest.of(0, BATCH)));
            if (stale == null || stale.isEmpty()) {
                break;
            }
            List<Long> done = new ArrayList<>();
            for (ImageUploadSlot slot : stale) {
                try {
                    storage.deleteStaged(slot.getStorageKey());
                    done.add(slot.getId());
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("Upload cleanup could not delete staged {}: {}", slot.getStorageKey(), e.toString());
                }
            }
            if (!done.isEmpty()) {
                tx.executeWithoutResult(status -> slots.markDiscarded(done, now));
                discarded += done.size();
            }
            if (done.size() < stale.size()) {
                // The storage is failing: try again on the next run (the lifecycle rule is the backstop).
                break;
            }
        }
        Integer purged = tx.execute(status -> slots.purge(now.minus(KEEP_ROWS)));
        return new Result(discarded, failed, purged == null ? 0 : purged);
    }
}
