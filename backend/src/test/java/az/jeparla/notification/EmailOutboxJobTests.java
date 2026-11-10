package az.jeparla.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.common.i18n.Language;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

/** The email outbox (#138): nothing is sent or claimed as sent without a provider (#131), failures retry. */
class EmailOutboxJobTests {

    private static final Instant NOW = Instant.parse("2026-11-10T09:00:00Z");

    private final EmailOutboxRepository outbox = mock(EmailOutboxRepository.class);
    private final TransactionTemplate tx = new TransactionTemplate(transactions());
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private static PlatformTransactionManager transactions() {
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenAnswer(invocation -> new SimpleTransactionStatus());
        return manager;
    }

    /** Records what it was asked to send; fails for addresses starting with "fail". */
    private static final class RecordingSender implements EmailSender {

        final List<String> sent = new ArrayList<>();

        @Override
        public boolean enabled() {
            return true;
        }

        @Override
        public void send(String to, String subject, String body) {
            if (to.startsWith("fail")) {
                throw new IllegalStateException("refused");
            }
            sent.add(to + "|" + subject);
        }
    }

    private EmailOutboxMessage message(String to) {
        EmailOutboxMessage message = new EmailOutboxMessage(1L, 2L, to, Language.RU, "Документ не принят", "Текст",
                NOW.minusSeconds(60));
        when(outbox.findById(any())).thenReturn(Optional.of(message));
        return message;
    }

    @Test
    void withoutAProviderNothingIsSentAndEverythingWaits() {
        EmailOutboxJob job = new EmailOutboxJob(outbox, new NoEmailSender(), tx, mock(LockingTaskExecutor.class), clock);
        assertThat(job.run()).isEqualTo(new EmailOutboxJob.Result(0, 0));
        verify(outbox, never()).findDue(any(), any(Pageable.class));
    }

    @Test
    void aSentMessageIsMarkedSent() {
        RecordingSender sender = new RecordingSender();
        EmailOutboxMessage message = message("seller@jeparla.test");
        when(outbox.findDue(any(), any(Pageable.class))).thenReturn(List.of(message));
        EmailOutboxJob job = new EmailOutboxJob(outbox, sender, tx, mock(LockingTaskExecutor.class), clock);

        assertThat(job.run()).isEqualTo(new EmailOutboxJob.Result(1, 0));
        assertThat(sender.sent).containsExactly("seller@jeparla.test|Документ не принят");
        assertThat(message.getStatus()).isEqualTo(EmailOutboxMessage.Status.SENT);
        assertThat(message.getAttempts()).isOne();
    }

    @Test
    void aFailedMessageIsRetriedLaterAndGivenUpAfterFiveAttempts() {
        RecordingSender sender = new RecordingSender();
        EmailOutboxMessage message = message("fail@jeparla.test");
        when(outbox.findDue(any(), any(Pageable.class))).thenReturn(List.of(message));
        EmailOutboxJob job = new EmailOutboxJob(outbox, sender, tx, mock(LockingTaskExecutor.class), clock);

        assertThat(job.run()).isEqualTo(new EmailOutboxJob.Result(0, 1));
        assertThat(message.getStatus()).isEqualTo(EmailOutboxMessage.Status.PENDING);
        assertThat(message.getNextAttemptAt()).isAfter(NOW);
        for (int attempt = 2; attempt <= EmailOutboxMessage.MAX_ATTEMPTS; attempt++) {
            job.run();
        }
        assertThat(message.getStatus()).isEqualTo(EmailOutboxMessage.Status.FAILED);
        assertThat(message.getAttempts()).isEqualTo(EmailOutboxMessage.MAX_ATTEMPTS);
        assertThat(sender.sent).isEmpty();
    }

    private EmailOutboxMessage linkMessage(Instant expiresAt) {
        EmailOutboxMessage message = EmailOutboxMessage.oneTimeLink(2L, "buyer@jeparla.test", Language.AZ,
                "Jeparla: şifrənin bərpası", "https://jeparla.az/az/reset-password#token=secret", NOW.minusSeconds(60),
                expiresAt);
        when(outbox.findById(any())).thenReturn(Optional.of(message));
        return message;
    }

    @Test
    void aSentOneTimeLinkLeavesNoLinkInTheOutbox() {
        RecordingSender sender = new RecordingSender();
        EmailOutboxMessage message = linkMessage(NOW.plusSeconds(3600));
        when(outbox.findDue(any(), any(Pageable.class))).thenReturn(List.of(message));
        EmailOutboxJob job = new EmailOutboxJob(outbox, sender, tx, mock(LockingTaskExecutor.class), clock);

        assertThat(job.run()).isEqualTo(new EmailOutboxJob.Result(1, 0));
        assertThat(message.getStatus()).isEqualTo(EmailOutboxMessage.Status.SENT);
        assertThat(message.getBody()).isEqualTo(EmailOutboxMessage.REDACTED_BODY);
        assertThat(message.getNotificationId()).isNull();
    }

    @Test
    void anExpiredOneTimeLinkIsNotSent() {
        RecordingSender sender = new RecordingSender();
        EmailOutboxMessage message = linkMessage(NOW);
        when(outbox.findDue(any(), any(Pageable.class))).thenReturn(List.of(message));
        EmailOutboxJob job = new EmailOutboxJob(outbox, sender, tx, mock(LockingTaskExecutor.class), clock);

        assertThat(job.run()).isEqualTo(new EmailOutboxJob.Result(0, 1));
        assertThat(sender.sent).isEmpty();
        assertThat(message.getStatus()).isEqualTo(EmailOutboxMessage.Status.FAILED);
        assertThat(message.getBody()).isEqualTo(EmailOutboxMessage.REDACTED_BODY);
    }

    @Test
    void anOrdinaryNotificationKeepsItsBody() {
        RecordingSender sender = new RecordingSender();
        EmailOutboxMessage message = message("seller@jeparla.test");
        when(outbox.findDue(any(), any(Pageable.class))).thenReturn(List.of(message));
        new EmailOutboxJob(outbox, sender, tx, mock(LockingTaskExecutor.class), clock).run();
        assertThat(message.getBody()).isEqualTo("Текст");
    }
}
