package az.jeparla.notification;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
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
 * Sends the email outbox (#138) through the {@link EmailSender}: every minute ({@code
 * jeparla.notifications.email-cron}, {@code -} turns it off), under the ShedLock lock {@value #LOCK_NAME}.
 * Without a provider ({@link NoEmailSender}, #131) it sends nothing and the messages stay PENDING. A message
 * that fails is retried with a growing pause and given up after {@value EmailOutboxMessage#MAX_ATTEMPTS}
 * attempts. Logs carry the message id only, never the address or the text.
 */
@Service
public class EmailOutboxJob {

    public static final String LOCK_NAME = "email-outbox";
    private static final int BATCH = 50;
    private static final Duration LOCK_AT_MOST_FOR = Duration.ofMinutes(10);

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxJob.class);

    /** What one run did. */
    public record Result(int sent, int failed) {
    }

    private final EmailOutboxRepository outbox;
    private final EmailSender sender;
    private final TransactionTemplate tx;
    private final LockingTaskExecutor locks;
    private final Clock clock;

    public EmailOutboxJob(EmailOutboxRepository outbox, EmailSender sender, TransactionTemplate tx,
            LockingTaskExecutor locks, Clock clock) {
        this.outbox = outbox;
        this.sender = sender;
        this.tx = tx;
        this.locks = locks;
        this.clock = clock;
    }

    @Scheduled(cron = "${jeparla.notifications.email-cron:0 * * * * *}")
    void scheduled() {
        if (!sender.enabled()) {
            return;
        }
        LockConfiguration lock = new LockConfiguration(ClockProvider.now(), LOCK_NAME, LOCK_AT_MOST_FOR, Duration.ZERO);
        try {
            TaskResult<Result> result = locks.executeWithLock(this::run, lock);
            if (result.wasExecuted() && result.getResult() != null
                    && result.getResult().sent() + result.getResult().failed() > 0) {
                log.info("Email outbox: {} sent, {} failed", result.getResult().sent(), result.getResult().failed());
            }
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable e) {
            throw new IllegalStateException("Email outbox failed", e);
        }
    }

    /** One pass over the due messages; each message in its own transaction. */
    Result run() {
        if (!sender.enabled()) {
            return new Result(0, 0);
        }
        Instant now = clock.instant();
        List<EmailOutboxMessage> due = tx.execute(status -> outbox.findDue(now, PageRequest.of(0, BATCH)));
        int sent = 0;
        int failed = 0;
        for (EmailOutboxMessage message : due == null ? List.<EmailOutboxMessage>of() : due) {
            String error = null;
            try {
                sender.send(message.getToAddress(), message.getSubject(), message.getBody());
            } catch (RuntimeException e) {
                error = e.getClass().getSimpleName() + ": " + e.getMessage();
                log.warn("Email {} could not be sent: {}", message.getId(), e.getClass().getSimpleName());
            }
            String outcome = error;
            tx.executeWithoutResult(status -> outbox.findById(message.getId()).ifPresent(current -> {
                if (outcome == null) {
                    current.sent(clock.instant());
                } else {
                    current.failed(outcome, clock.instant());
                }
            }));
            if (error == null) {
                sent++;
            } else {
                failed++;
            }
        }
        return new Result(sent, failed);
    }
}
