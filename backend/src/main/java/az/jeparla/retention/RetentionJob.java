package az.jeparla.retention;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.storage.ObjectStorage;
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
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Deletes what the privacy policy says is kept only for a while (#249, docs/legal/analysis.md section 5):
 * <ul>
 *   <li>verification documents (row and private file): approved ones 3 years after the store's relationship with
 *       Jeparla ended, rejected ones 90 days after the decision (a document rejected for authenticity or named by a
 *       suspension request is evidence and stays);</li>
 *   <li>closed complaints 3 years after the decision;</li>
 *   <li>the audit log after 7 years, through {@code jeparla_purge_audit_logs} (V57).</li>
 * </ul>
 * Nothing of a store under legal hold is touched; the conditions are in {@link RetentionStore} and the database
 * function. Daily, ShedLock lock {@value #LOCK_NAME}, idempotent. Each document is deleted in its own transaction
 * together with its file, so a failed file deletion keeps the row for the next run. A run that deleted something
 * writes one audit row with the counts.
 */
@Service
public class RetentionJob {

    public static final String LOCK_NAME = "data-retention";
    static final Duration LOCK_AT_MOST_FOR = Duration.ofMinutes(30);
    static final int BATCH = 200;
    static final int MAX_BATCHES = 50;

    private static final Logger log = LoggerFactory.getLogger(RetentionJob.class);

    /** What one run did. */
    public record Result(int documents, int documentsFailed, int reports, long auditRows) {

        boolean changedSomething() {
            return documents + reports + auditRows > 0;
        }
    }

    private final RetentionStore store;
    private final ObjectStorage storage;
    private final TransactionTemplate tx;
    private final LockingTaskExecutor locks;
    private final AuditService audit;

    public RetentionJob(RetentionStore store, ObjectStorage storage, TransactionTemplate tx,
            LockingTaskExecutor locks, AuditService audit) {
        this.store = store;
        this.storage = storage;
        this.tx = tx;
        this.locks = locks;
        this.audit = audit;
    }

    @Scheduled(cron = "${jeparla.retention.cron:0 40 4 * * *}", zone = "Asia/Baku")
    void scheduled() {
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME, LOCK_AT_MOST_FOR,
                Duration.ZERO);
        try {
            TaskResult<Result> result = locks.executeWithLock(this::run, lock);
            Result done = result.wasExecuted() ? result.getResult() : null;
            if (done != null && (done.changedSomething() || done.documentsFailed() > 0)) {
                log.info("Retention: {} documents deleted ({} failed), {} complaints, {} audit rows", done.documents(),
                        done.documentsFailed(), done.reports(), done.auditRows());
            }
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Retention failed", e);
        }
    }

    Result run() {
        int documents = 0;
        int failed = 0;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            List<RetentionStore.DueDocument> due = store.dueDocuments(BATCH);
            int before = documents;
            for (RetentionStore.DueDocument document : due) {
                try {
                    Boolean deleted = tx.execute(status -> {
                        Optional<String> key = store.deleteDocument(document.id());
                        // Inside the transaction: if the file cannot be deleted, the row stays for the next run.
                        key.ifPresent(storage::deletePrivate);
                        return key.isPresent();
                    });
                    if (Boolean.TRUE.equals(deleted)) {
                        documents++;
                    }
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("Retention could not delete document {}: {}", document.id(), e.toString());
                }
            }
            // A short page, or a page where nothing could be deleted (it would come back unchanged), ends the loop.
            if (due.size() < BATCH || documents == before) {
                break;
            }
        }
        Integer reports = tx.execute(status -> store.deleteReports());
        Long auditRows = tx.execute(status -> store.purgeAuditLogs());
        Result result = new Result(documents, failed, reports == null ? 0 : reports,
                auditRows == null ? 0 : auditRows);
        if (result.changedSomething()) {
            tx.executeWithoutResult(status -> audit.record("RETENTION_APPLIED", AuditTargetType.STORE, null, null,
                    null, "{\"documents\":" + result.documents() + ",\"reports\":" + result.reports()
                            + ",\"auditRows\":" + result.auditRows() + "}"));
        }
        return result;
    }
}
