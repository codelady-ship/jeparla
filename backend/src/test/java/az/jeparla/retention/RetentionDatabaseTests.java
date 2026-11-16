package az.jeparla.retention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.support.PostgresContainerConfig;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Each retention period of {@link RetentionStore} against PostgreSQL, as the runtime role the API uses (#249,
 * docs/legal/analysis.md section 5), and that nothing of a store under legal hold is ever deleted.
 */
@Testcontainers(disabledWithoutDocker = true)
class RetentionDatabaseTests {

    @Container
    static final PostgreSQLContainer POSTGRES = PostgresContainerConfig.container();

    private static final AtomicInteger SEQ = new AtomicInteger();

    private static JdbcTemplate app;
    private static RetentionStore retention;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), PostgresContainerConfig.MIGRATION_USER,
                        PostgresContainerConfig.MIGRATION_PASSWORD)
                .locations("classpath:db/migration")
                .placeholders(PostgresContainerConfig.placeholders())
                .load()
                .migrate();
        app = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(),
                PostgresContainerConfig.RUNTIME_USER, PostgresContainerConfig.RUNTIME_PASSWORD));
        retention = new RetentionStore(app);
    }

    // ------------------------------------------------------------------ documents

    @Test
    void anApprovedDocumentGoesThreeYearsAfterTheRelationshipEnded() {
        long ended = store("BLOCKED", "4 years");
        long endedRecently = store("BLOCKED", "2 years");
        long stillSelling = store("APPROVED", "4 years");
        UUID due = document(ended, "VERIFIED", null, "5 years");
        UUID recent = document(endedRecently, "VERIFIED", null, "5 years");
        UUID selling = document(stillSelling, "VERIFIED", null, "5 years");

        deleteDueDocuments();

        assertThat(exists(due)).isFalse();
        assertThat(exists(recent)).isTrue();
        assertThat(exists(selling)).isTrue();
    }

    @Test
    void aRejectedOrdinaryDocumentGoesAfterNinetyDays() {
        long store = store("APPROVED", "1 day");
        UUID rejected = document(store, "REJECTED", "UNREADABLE", "91 days");
        UUID changes = document(store, "CHANGES_REQUESTED", "EXPIRED", "100 days");
        UUID young = document(store, "REJECTED", "MISMATCH", "89 days");
        UUID pending = document(store, "PENDING", null, null);
        app.update("UPDATE verification_documents SET created_at = now() - INTERVAL '2 years' WHERE id = ?", pending);

        deleteDueDocuments();

        assertThat(exists(rejected)).isFalse();
        assertThat(exists(changes)).isFalse();
        assertThat(exists(young)).isTrue();
        assertThat(exists(pending)).isTrue();
    }

    @Test
    void aSuspiciousDocumentIsEvidenceAndStays() {
        long store = store("BLOCKED", "5 years");
        UUID authenticity = document(store, "REJECTED", "AUTHENTICITY", "2 years");
        UUID named = document(store, "REJECTED", "UNREADABLE", "2 years");
        app.update("""
                INSERT INTO store_suspension_requests (store_id, document_id, status, requested_at, decided_at)
                VALUES (?, ?, 'DISMISSED', now() - INTERVAL '2 years', now() - INTERVAL '2 years')
                """, store, named);

        deleteDueDocuments();

        assertThat(exists(authenticity)).isTrue();
        assertThat(exists(named)).isTrue();
    }

    @Test
    void theDeleteReturnsTheKeyOnlyWhileTheDocumentIsDue() {
        long store = store("APPROVED", "1 day");
        UUID rejected = document(store, "REJECTED", "UNREADABLE", "91 days");
        UUID young = document(store, "REJECTED", "UNREADABLE", "10 days");

        assertThat(retention.deleteDocument(young)).isEmpty();
        assertThat(retention.deleteDocument(rejected)).contains("documents/" + store + "/" + rejected + ".pdf");
        assertThat(retention.deleteDocument(rejected)).isEmpty();
    }

    // ------------------------------------------------------------------ complaints

    @Test
    void aClosedComplaintGoesThreeYearsAfterTheDecision() {
        long store = store("APPROVED", "1 day");
        long resolved = report(store, "RESOLVED", "4 years");
        long dismissed = report(store, "DISMISSED", "4 years");
        long recent = report(store, "RESOLVED", "2 years");
        long open = report(store, "OPEN", null);

        retention.deleteReports();

        assertThat(reportExists(resolved)).isFalse();
        assertThat(reportExists(dismissed)).isFalse();
        assertThat(reportExists(recent)).isTrue();
        assertThat(reportExists(open)).isTrue();
    }

    // ------------------------------------------------------------------ audit log

    @Test
    void theAuditLogIsKeptSevenYears() {
        long store = store("APPROVED", "1 day");
        long old = audit("STORE", String.valueOf(store), null, "8 years");
        long young = audit("STORE", String.valueOf(store), null, "6 years");
        // A declaration upload's rows stay with the declaration (pseudonymised, V56).
        long declaration = app.queryForObject("""
                INSERT INTO audit_logs (actor_label, action, target_type, target_id, details, created_at)
                VALUES ('Signer', 'DECLARATION_CONFIRMED', 'STORE', ?, '{"declarationId":1}'::jsonb,
                        now() - INTERVAL '8 years')
                RETURNING id
                """, Long.class, String.valueOf(store));

        assertThat(retention.purgeAuditLogs()).isPositive();

        assertThat(auditExists(old)).isFalse();
        assertThat(auditExists(young)).isTrue();
        assertThat(auditExists(declaration)).isTrue();
    }

    @Test
    void theRuntimeRoleMayPurgeButNotShorterThanSevenYears() {
        assertThatThrownBy(() -> app.queryForObject("SELECT jeparla_purge_audit_logs(INTERVAL '6 years')",
                Long.class)).rootCause().hasMessageContaining("at least 7 years");
        // Still no DELETE of its own.
        long old = audit("STORE", "1", null, "9 years");
        assertThatThrownBy(() -> app.update("DELETE FROM audit_logs WHERE id = ?", old)).rootCause()
                .hasMessageContaining("permission denied");
    }

    // ------------------------------------------------------------------ legal hold

    @Test
    void nothingOfAStoreUnderLegalHoldIsEverDeleted() {
        long held = store("BLOCKED", "10 years");
        UUID approved = document(held, "VERIFIED", null, "10 years");
        UUID rejected = document(held, "REJECTED", "UNREADABLE", "1 year");
        long report = report(held, "RESOLVED", "10 years");
        long storeRow = audit("STORE", String.valueOf(held), null, "10 years");
        long namedRow = audit("CATALOG", null, "{\"storeId\":" + held + "}", "10 years");
        long documentRow = audit("DOCUMENT", approved.toString(), null, "10 years");
        long reportRow = audit("REPORT", String.valueOf(report), null, "10 years");
        long productRow = audit("PRODUCT", String.valueOf(product(held)), null, "10 years");
        app.update("UPDATE stores SET legal_hold_at = now(), legal_hold_reason = 'Court request no. 12',"
                + " updated_at = now() - INTERVAL '10 years' WHERE id = ?", held);

        deleteDueDocuments();
        assertThat(retention.deleteDocument(approved)).isEmpty();
        retention.deleteReports();
        retention.purgeAuditLogs();

        assertThat(exists(approved)).isTrue();
        assertThat(exists(rejected)).isTrue();
        assertThat(reportExists(report)).isTrue();
        for (long row : new long[] {storeRow, namedRow, documentRow, reportRow, productRow}) {
            assertThat(auditExists(row)).as("audit row %d", row).isTrue();
        }

        // Released: the same data is due again.
        app.update("UPDATE stores SET legal_hold_at = NULL, legal_hold_reason = NULL,"
                + " updated_at = now() - INTERVAL '10 years' WHERE id = ?", held);
        deleteDueDocuments();
        retention.deleteReports();
        retention.purgeAuditLogs();
        assertThat(exists(approved)).isFalse();
        assertThat(exists(rejected)).isFalse();
        assertThat(reportExists(report)).isFalse();
        assertThat(auditExists(storeRow)).isFalse();
    }

    // ------------------------------------------------------------------ fixtures

    private static void deleteDueDocuments() {
        for (RetentionStore.DueDocument due : retention.dueDocuments(1000)) {
            retention.deleteDocument(due.id());
        }
    }

    /** A store with the given status, last changed {@code changedAgo} ago. */
    private static long store(String status, String changedAgo) {
        int n = SEQ.incrementAndGet();
        long owner = app.queryForObject("""
                INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', ?) RETURNING id
                """, Long.class, "retention" + n + "@jeparla.test", "Owner " + n);
        long store = app.queryForObject("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id, status)
                VALUES (?, ?, 'Store', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890', ?)
                RETURNING id
                """, Long.class, owner, "retention-store-" + n, status);
        app.update("UPDATE stores SET updated_at = now() - CAST(? AS INTERVAL) WHERE id = ?", changedAgo, store);
        return store;
    }

    /** A document with the given status, decided {@code reviewedAgo} ago (null: not reviewed). */
    private static UUID document(long store, String status, String rejectReason, String reviewedAgo) {
        UUID id = UUID.randomUUID();
        app.update("""
                INSERT INTO verification_documents (id, store_id, check_kind, kind, storage_key, file_name,
                                                    content_type, size_bytes, status, reject_reason, reviewed_at)
                VALUES (?, ?, 'DOCUMENTS', 'TAX_ID', ?, 'tax.pdf', 'application/pdf', 100, ?, ?,
                        now() - CAST(? AS INTERVAL))
                """, id, store, "documents/" + store + "/" + id + ".pdf", status, rejectReason, reviewedAgo);
        return id;
    }

    private static long report(long store, String status, String resolvedAgo) {
        return app.queryForObject("""
                INSERT INTO product_reports (store_id, reason, status, resolved_at, created_at)
                VALUES (?, 'OTHER', ?, now() - CAST(? AS INTERVAL), now() - INTERVAL '11 years')
                RETURNING id
                """, Long.class, store, status, resolvedAgo);
    }

    private static long product(long store) {
        int n = SEQ.incrementAndGet();
        long category = app.queryForObject("""
                INSERT INTO categories (slug, name_az, name_en, name_ru) VALUES (?, 'Üzük', 'Ring', 'Кольцо')
                RETURNING id
                """, Long.class, "retention-uzuk-" + n);
        return app.queryForObject("""
                INSERT INTO products (store_id, category_id, slug, name_az, metal)
                VALUES (?, ?, ?, 'Qızıl üzük', 'GOLD') RETURNING id
                """, Long.class, store, category, "retention-product-" + n);
    }

    private static long audit(String targetType, String targetId, String details, String ago) {
        return app.queryForObject("""
                INSERT INTO audit_logs (actor_label, action, target_type, target_id, details, created_at)
                VALUES ('system', 'TEST_EVENT', ?, ?, CAST(? AS JSONB), now() - CAST(? AS INTERVAL))
                RETURNING id
                """, Long.class, targetType, targetId, details, ago);
    }

    private static boolean exists(UUID document) {
        return app.queryForObject("SELECT count(*) FROM verification_documents WHERE id = ?", Integer.class,
                document) == 1;
    }

    private static boolean reportExists(long id) {
        return app.queryForObject("SELECT count(*) FROM product_reports WHERE id = ?", Integer.class, id) == 1;
    }

    private static boolean auditExists(long id) {
        return app.queryForObject("SELECT count(*) FROM audit_logs WHERE id = ?", Integer.class, id) == 1;
    }
}
