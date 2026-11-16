package az.jeparla.verification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.verification.DeclarationRetentionStore.Candidate;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.LongStream;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Declaration retention (#138, docs/legal/analysis.md section 5) without a database: the pseudonym, the
 * settings and the job's loop. The SQL conditions and the triggers are tested against PostgreSQL in
 * {@code EvidenceTablesTests}.
 */
class DeclarationRetentionTests {

    private static final String KEY = "0123456789abcdef0123456789abcdef";

    private final DeclarationRetentionStore store = mock(DeclarationRetentionStore.class);
    private final AuditService audit = mock(AuditService.class);
    private final TransactionTemplate tx = new TransactionTemplate(mock(PlatformTransactionManager.class));

    private DeclarationRetentionJob job(String key) {
        return new DeclarationRetentionJob(store, new DeclarationRetentionProperties(7, key, Duration.ofMinutes(30)),
                tx, mock(LockingTaskExecutor.class), audit);
    }

    // ------------------------------------------------------------------ pseudonym

    @Test
    void thePseudonymIsAKeyedHashInTheFormatTheDatabaseAccepts() {
        LabelPseudonym pseudonym = new LabelPseudonym(KEY);
        String label = "Aysel Mammadova <aysel@example.az>";
        String hash = pseudonym.of(label);

        assertThat(hash).matches(LabelPseudonym.FORMAT).doesNotContain("Aysel").doesNotContain("example");
        // Deterministic: a known person's label can be matched later.
        assertThat(pseudonym.of(label)).isEqualTo(hash);
        // A different label or a different key gives a different value.
        assertThat(pseudonym.of(label + " ")).isNotEqualTo(hash);
        assertThat(new LabelPseudonym(KEY.toUpperCase()).of(label)).isNotEqualTo(hash);
        // Running twice never hashes a hash.
        assertThat(pseudonym.of(hash)).isEqualTo(hash);
    }

    @Test
    void thePseudonymNeedsAKeyAndALabel() {
        assertThatThrownBy(() -> new LabelPseudonym(" ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LabelPseudonym(KEY).of(null)).isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------------------------ settings

    @Test
    void theRetentionCannotBeShorterThanTheLegalFloor() {
        assertThatThrownBy(() -> new DeclarationRetentionProperties(6, KEY, Duration.ofMinutes(30)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("between 7 and 30");
        assertThat(new DeclarationRetentionProperties(DeclarationRetentionProperties.MIN_YEARS, KEY,
                Duration.ofMinutes(30)).retentionYears()).isEqualTo(7);
    }

    @Test
    void aShortKeyIsRefusedAndTheKeyNeverReachesALog() {
        assertThatThrownBy(() -> new DeclarationRetentionProperties(7, "short", Duration.ofMinutes(30)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("at least 32");
        DeclarationRetentionProperties properties = new DeclarationRetentionProperties(7, " " + KEY + " ",
                Duration.ofMinutes(30));
        assertThat(properties.enabled()).isTrue();
        assertThat(properties.pseudonymKey()).isEqualTo(KEY);
        assertThat(properties.toString()).doesNotContain(KEY).contains("<set>");
        assertThat(new DeclarationRetentionProperties(7, "", Duration.ofMinutes(30)).enabled()).isFalse();
    }

    // ------------------------------------------------------------------ job

    @Test
    void withoutAKeyTheJobTouchesNothing() {
        DeclarationRetentionJob.Result result = job("").run();

        assertThat(result.enabled()).isFalse();
        verifyNoInteractions(store, audit);
    }

    @Test
    void dueDeclarationsArePseudonymisedOnceAndTheRunIsAudited() {
        when(store.due(eq(7), eq(0L), anyInt())).thenReturn(List.of(
                new Candidate(11, "Seller One <one@example.az>"),
                new Candidate(12, "Seller Two <+994501112233>")));
        // 11: the declaration and two audit rows; 12: no longer due when the function re-checked it.
        when(store.pseudonymise(eq(11L), anyString(), eq(7))).thenReturn(3);
        when(store.pseudonymise(eq(12L), anyString(), eq(7))).thenReturn(0);

        DeclarationRetentionJob.Result result = job(KEY).run();

        assertThat(result).isEqualTo(new DeclarationRetentionJob.Result(true, 1, 2));
        String expected = new LabelPseudonym(KEY).of("Seller One <one@example.az>");
        verify(store).pseudonymise(11L, expected, 7);
        verify(audit).record(eq("DECLARATIONS_PSEUDONYMISED"), eq(AuditTargetType.STORE), isNull(), isNull(),
                isNull(), contains("\"declarations\":1,\"auditRows\":2,\"retentionYears\":7"));
    }

    @Test
    void nothingDueWritesNoAuditRow() {
        when(store.due(anyInt(), anyLong(), anyInt())).thenReturn(List.of());

        assertThat(job(KEY).run()).isEqualTo(new DeclarationRetentionJob.Result(true, 0, 0));
        verify(store, never()).pseudonymise(anyLong(), anyString(), anyInt());
        verifyNoInteractions(audit);
    }

    @Test
    void fullBatchesAreFollowedByTheNextPageAfterTheLastId() {
        List<Candidate> first = new ArrayList<>();
        LongStream.rangeClosed(1, DeclarationRetentionJob.BATCH).forEach(id -> first.add(new Candidate(id, "L" + id)));
        when(store.due(eq(7), eq(0L), eq(DeclarationRetentionJob.BATCH))).thenReturn(first);
        when(store.due(eq(7), eq((long) DeclarationRetentionJob.BATCH), eq(DeclarationRetentionJob.BATCH)))
                .thenReturn(List.of(new Candidate(DeclarationRetentionJob.BATCH + 5L, "Last")));
        when(store.pseudonymise(anyLong(), anyString(), eq(7))).thenReturn(1);

        DeclarationRetentionJob.Result result = job(KEY).run();

        assertThat(result.declarations()).isEqualTo(DeclarationRetentionJob.BATCH + 1);
        assertThat(result.auditRows()).isZero();
        verify(store, times(2)).due(eq(7), anyLong(), eq(DeclarationRetentionJob.BATCH));
        verify(audit).record(any(), any(), any(), any(), any(), any());
    }
}
