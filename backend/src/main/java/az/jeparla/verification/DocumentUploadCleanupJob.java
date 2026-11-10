package az.jeparla.verification;

import az.jeparla.common.storage.ObjectStorage;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
 * Deletes document uploads that were never confirmed (#40), as {@code ImageUploadCleanupJob} does for photos:
 * the staged file of every open upload whose URL expired more than {@link #MARGIN} ago, then rows older than
 * {@link #KEEP_ROWS}. Staged files are private; the bucket's lifecycle rule on {@code staging/} is the
 * backstop. Same cron as the photo cleanup, ShedLock lock {@value #LOCK_NAME}.
 */
@Service
public class DocumentUploadCleanupJob {

    public static final String LOCK_NAME = "document-upload-cleanup";
    static final Duration MARGIN = Duration.ofHours(1);
    static final Duration KEEP_ROWS = Duration.ofDays(2);
    private static final int BATCH = 200;
    private static final int MAX_BATCHES = 20;

    private static final Logger log = LoggerFactory.getLogger(DocumentUploadCleanupJob.class);

    /** What one run did. */
    public record Result(int discarded, int failed, int purged) {
    }

    private final DocumentUploadSlotRepository slots;
    private final ObjectStorage storage;
    private final TransactionTemplate tx;
    private final LockingTaskExecutor locks;
    private final DocumentProperties properties;
    private final Clock clock;

    public DocumentUploadCleanupJob(DocumentUploadSlotRepository slots, ObjectStorage storage, TransactionTemplate tx,
            LockingTaskExecutor locks, DocumentProperties properties, Clock clock) {
        this.slots = slots;
        this.storage = storage;
        this.tx = tx;
        this.locks = locks;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(cron = "${jeparla.merchant.images.cleanup-cron:0 7/30 * * * *}")
    void scheduled() {
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME,
                properties.cleanupLockAtMostFor(), Duration.ZERO);
        try {
            TaskResult<Result> result = locks.executeWithLock(this::run, lock);
            Result done = result.wasExecuted() ? result.getResult() : null;
            if (done != null && done.discarded() + done.failed() + done.purged() > 0) {
                log.info("Document upload cleanup: {} staged files deleted, {} failed, {} rows purged",
                        done.discarded(), done.failed(), done.purged());
            }
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Document upload cleanup failed", e);
        }
    }

    Result run() {
        Instant now = clock.instant();
        int discarded = 0;
        int failed = 0;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            List<DocumentUploadSlot> stale = tx.execute(status -> slots.findStale(now.minus(MARGIN),
                    PageRequest.of(0, BATCH)));
            if (stale == null || stale.isEmpty()) {
                break;
            }
            List<Long> done = new ArrayList<>();
            for (DocumentUploadSlot slot : stale) {
                try {
                    storage.deleteStaged(slot.getStorageKey());
                    done.add(slot.getId());
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("Document cleanup could not delete staged {}: {}", slot.getStorageKey(), e.toString());
                }
            }
            if (!done.isEmpty()) {
                tx.executeWithoutResult(status -> slots.markDiscarded(done, now));
                discarded += done.size();
            }
            if (done.size() < stale.size()) {
                break;
            }
        }
        Integer purged = tx.execute(status -> slots.purge(now.minus(KEEP_ROWS)));
        return new Result(discarded, failed, purged == null ? 0 : purged);
    }
}
