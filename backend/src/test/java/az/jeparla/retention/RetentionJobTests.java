package az.jeparla.retention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.retention.RetentionStore.DueDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The retention job's loop without a database (#249). The SQL conditions (each period, legal hold) are tested
 * against PostgreSQL in {@code RetentionDatabaseTests}.
 */
class RetentionJobTests {

    private final RetentionStore store = mock(RetentionStore.class);
    private final ObjectStorage storage = mock(ObjectStorage.class);
    private final AuditService audit = mock(AuditService.class);
    private final TransactionTemplate tx = new TransactionTemplate(mock(PlatformTransactionManager.class));
    private final RetentionJob job = new RetentionJob(store, storage, tx, mock(LockingTaskExecutor.class), audit);

    @Test
    void thePeriodsAreThoseOfThePrivacyPolicy() {
        assertThat(RetentionStore.APPROVED_DOCUMENT_YEARS).isEqualTo(3);
        assertThat(RetentionStore.REJECTED_DOCUMENT_DAYS).isEqualTo(90);
        assertThat(RetentionStore.REPORT_YEARS).isEqualTo(3);
        assertThat(RetentionStore.AUDIT_YEARS).isEqualTo(7);
    }

    @Test
    void dueDocumentsLoseRowAndFileAndTheRunIsAudited() {
        UUID one = UUID.randomUUID();
        UUID two = UUID.randomUUID();
        when(store.dueDocuments(anyInt())).thenReturn(List.of(new DueDocument(one, "documents/1/a.pdf"),
                new DueDocument(two, "documents/1/b.pdf")));
        when(store.deleteDocument(one)).thenReturn(Optional.of("documents/1/a.pdf"));
        // Two was no longer due when the delete re-checked it (e.g. a legal hold was placed meanwhile).
        when(store.deleteDocument(two)).thenReturn(Optional.empty());
        when(store.deleteReports()).thenReturn(4);
        when(store.purgeAuditLogs()).thenReturn(10L);

        RetentionJob.Result result = job.run();

        assertThat(result).isEqualTo(new RetentionJob.Result(1, 0, 4, 10));
        verify(storage).deletePrivate("documents/1/a.pdf");
        verify(storage, never()).deletePrivate("documents/1/b.pdf");
        verify(audit).record(eq("RETENTION_APPLIED"), eq(AuditTargetType.STORE), isNull(), isNull(), isNull(),
                contains("\"documents\":1,\"reports\":4,\"auditRows\":10"));
    }

    @Test
    void aFileThatCannotBeDeletedIsCountedAndTheRestGoesOn() {
        UUID one = UUID.randomUUID();
        when(store.dueDocuments(anyInt())).thenReturn(List.of(new DueDocument(one, "documents/1/a.pdf")));
        when(store.deleteDocument(one)).thenReturn(Optional.of("documents/1/a.pdf"));
        doThrow(new IllegalStateException("storage down")).when(storage).deletePrivate(any());

        RetentionJob.Result result = job.run();

        assertThat(result.documents()).isZero();
        assertThat(result.documentsFailed()).isOne();
        verify(store).deleteReports();
        verify(store).purgeAuditLogs();
    }

    @Test
    void nothingDueWritesNoAuditRow() {
        when(store.dueDocuments(anyInt())).thenReturn(List.of());

        assertThat(job.run()).isEqualTo(new RetentionJob.Result(0, 0, 0, 0));
        verifyNoInteractions(storage, audit);
    }
}
