package az.jeparla.verification;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import java.time.Duration;
import java.util.List;
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
 * Pseudonymises the IP address and the user label of old seller declarations and of their audit rows (#138,
 * docs/legal/analysis.md section 5): due when the declaration, the store's last declaration and the end of the
 * store's relationship with Jeparla are all older than {@code retention-years} (default 7), and the store is not
 * under legal hold. The rows themselves stay (they are evidence); only the IP becomes NULL and the label a keyed
 * hash ({@link LabelPseudonym}).
 *
 * <p>Daily, ShedLock lock {@value #LOCK_NAME}, idempotent: each declaration is changed once, in its own
 * transaction, by the database function that re-checks every condition. Without {@code JEPARLA_PSEUDONYM_KEY} it
 * does nothing and logs a warning. A run that changed something writes one audit row with the counts (not the
 * values).
 */
@Service
public class DeclarationRetentionJob {

    public static final String LOCK_NAME = "declaration-retention";
    static final int BATCH = 200;
    static final int MAX_BATCHES = 50;

    private static final Logger log = LoggerFactory.getLogger(DeclarationRetentionJob.class);

    /** What one run did; {@code enabled} is false without a key. */
    public record Result(boolean enabled, int declarations, int auditRows) {
    }

    private final DeclarationRetentionStore store;
    private final DeclarationRetentionProperties properties;
    private final TransactionTemplate tx;
    private final LockingTaskExecutor locks;
    private final AuditService audit;

    public DeclarationRetentionJob(DeclarationRetentionStore store, DeclarationRetentionProperties properties,
            TransactionTemplate tx, LockingTaskExecutor locks, AuditService audit) {
        this.store = store;
        this.properties = properties;
        this.tx = tx;
        this.locks = locks;
        this.audit = audit;
    }

    @Scheduled(cron = "${jeparla.verification.declarations.cron:0 20 4 * * *}", zone = "Asia/Baku")
    void scheduled() {
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME,
                properties.lockAtMostFor(), Duration.ZERO);
        try {
            TaskResult<Result> result = locks.executeWithLock(this::run, lock);
            Result done = result.wasExecuted() ? result.getResult() : null;
            if (done != null && done.declarations() > 0) {
                log.info("Declaration retention: {} declarations and {} audit rows pseudonymised",
                        done.declarations(), done.auditRows());
            }
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Declaration retention failed", e);
        }
    }

    Result run() {
        if (!properties.enabled()) {
            log.warn("Declaration retention is off: JEPARLA_PSEUDONYM_KEY is not set (docs/legal/analysis.md)");
            return new Result(false, 0, 0);
        }
        int years = properties.retentionYears();
        LabelPseudonym pseudonym = new LabelPseudonym(properties.pseudonymKey());
        int declarations = 0;
        int auditRows = 0;
        long after = 0;
        for (int batch = 0; batch < MAX_BATCHES; batch++) {
            List<DeclarationRetentionStore.Candidate> due = store.due(years, after, BATCH);
            for (DeclarationRetentionStore.Candidate candidate : due) {
                after = candidate.id();
                Integer changed = tx.execute(status -> store.pseudonymise(candidate.id(),
                        pseudonym.of(candidate.userLabel()), years));
                if (changed != null && changed > 0) {
                    declarations++;
                    auditRows += changed - 1;
                }
            }
            if (due.size() < BATCH) {
                break;
            }
        }
        if (declarations > 0) {
            int doneDeclarations = declarations;
            int doneAuditRows = auditRows;
            tx.executeWithoutResult(status -> audit.record("DECLARATIONS_PSEUDONYMISED", AuditTargetType.STORE,
                    null, null, null, "{\"declarations\":" + doneDeclarations + ",\"auditRows\":" + doneAuditRows
                            + ",\"retentionYears\":" + years + "}"));
        }
        return new Result(true, declarations, auditRows);
    }
}
