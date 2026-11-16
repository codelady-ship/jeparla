package az.jeparla.retention;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Database side of {@link RetentionJob} (#249, docs/legal/analysis.md section 5). Every statement carries the
 * whole condition, so a row that stopped being due (legal hold placed, store approved again) is never deleted.
 */
@Repository
public class RetentionStore {

    /** Years an approved document is kept after the store's relationship with Jeparla ended. */
    public static final int APPROVED_DOCUMENT_YEARS = 3;
    /** Days a rejected (not suspicious) document is kept after the decision. */
    public static final int REJECTED_DOCUMENT_DAYS = 90;
    /** Years a closed complaint is kept after the decision. */
    public static final int REPORT_YEARS = 3;
    /** Years the audit log is kept (the database function refuses less). */
    public static final int AUDIT_YEARS = 7;

    /** A document due for deletion and its key in the private bucket. */
    public record DueDocument(UUID id, String storageKey) {
    }

    // d: verification_documents, s: its store. Never under legal hold, never a document a suspension request
    // points at (a suspected forgery stays as evidence), never a document rejected for AUTHENTICITY.
    //   * VERIFIED: the store is no longer APPROVED and has not changed for 3 years (the end of the relationship,
    //     as in the declaration retention of V56);
    //   * REJECTED or CHANGES_REQUESTED: the decision is older than 90 days.
    private static final String DUE_DOCUMENT = """
            s.legal_hold_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM store_suspension_requests q WHERE q.document_id = d.id)
            AND ((d.status = 'VERIFIED'
                    AND s.status <> 'APPROVED'
                    AND s.updated_at < now() - make_interval(years => %d))
                 OR (d.status IN ('REJECTED', 'CHANGES_REQUESTED')
                    AND d.reject_reason IS DISTINCT FROM 'AUTHENTICITY'
                    AND d.reviewed_at < now() - make_interval(days => %d)))
            """.formatted(APPROVED_DOCUMENT_YEARS, REJECTED_DOCUMENT_DAYS);

    private static final String DUE_DOCUMENTS = """
            SELECT d.id, d.storage_key
            FROM verification_documents d
                     JOIN stores s ON s.id = d.store_id
            WHERE %s
            ORDER BY d.id
            LIMIT ?
            """.formatted(DUE_DOCUMENT);

    // Blocks a concurrent legal hold (an UPDATE of the store) until the deletion is committed or rolled back.
    private static final String LOCK_STORE = """
            SELECT s.id FROM stores s JOIN verification_documents d ON d.store_id = s.id
            WHERE d.id = ? FOR SHARE OF s
            """;

    private static final String DELETE_DOCUMENT = """
            DELETE FROM verification_documents d
            USING stores s
            WHERE s.id = d.store_id
              AND d.id = ?
              AND %s
            RETURNING d.storage_key
            """.formatted(DUE_DOCUMENT);

    private static final String DELETE_REPORTS = """
            DELETE FROM product_reports r
            USING stores s
            WHERE s.id = r.store_id
              AND s.legal_hold_at IS NULL
              AND r.status IN ('RESOLVED', 'DISMISSED')
              AND r.resolved_at < now() - make_interval(years => %d)
            """.formatted(REPORT_YEARS);

    private final JdbcTemplate jdbc;

    public RetentionStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Up to {@code limit} documents due for deletion, by id. */
    public List<DueDocument> dueDocuments(int limit) {
        return jdbc.query(DUE_DOCUMENTS, (rs, i) -> new DueDocument(rs.getObject(1, UUID.class), rs.getString(2)),
                limit);
    }

    /**
     * Deletes the document row when it is still due, holding a share lock on its store until the caller's
     * transaction ends; the storage key of the deleted row, or empty when it was not due any more. Call inside a
     * transaction that also deletes the file, so a failed file deletion keeps the row.
     */
    public Optional<String> deleteDocument(UUID id) {
        jdbc.query(LOCK_STORE, rs -> null, id);
        List<String> keys = jdbc.query(DELETE_DOCUMENT, (rs, i) -> rs.getString(1), id);
        return keys.stream().findFirst();
    }

    /** Deletes the closed complaints older than {@link #REPORT_YEARS}; the number deleted. */
    public int deleteReports() {
        return jdbc.update(DELETE_REPORTS);
    }

    /** Purges the audit log older than {@link #AUDIT_YEARS} (V57); the number of rows deleted. */
    public long purgeAuditLogs() {
        Long removed = jdbc.queryForObject("SELECT jeparla_purge_audit_logs(make_interval(years => ?))", Long.class,
                AUDIT_YEARS);
        return removed == null ? 0 : removed;
    }
}
