package az.jeparla.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.persistence.DatabaseRoleCheck;
import az.jeparla.support.PostgresContainerConfig;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * The evidence tables (#165): seller declarations (V15) and the audit log (V7) can be read and appended to by
 * the runtime role the API connects with, and changed or removed by nobody but a superuser. Every statement
 * below that is refused for the runtime role was possible for it before V16, when the API connected as the
 * owner (and, in Docker, as the image's superuser).
 */
@Testcontainers(disabledWithoutDocker = true)
class EvidenceTablesTests {

    @Container
    static final PostgreSQLContainer POSTGRES = PostgresContainerConfig.container();

    private static final AtomicInteger SEQ = new AtomicInteger();

    /** The role of the API (spring.datasource.username). */
    private static JdbcTemplate app;
    /** The role of Flyway, owner of every table. */
    private static JdbcTemplate owner;
    /** The container's superuser. */
    private static JdbcTemplate superuser;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), PostgresContainerConfig.MIGRATION_USER,
                        PostgresContainerConfig.MIGRATION_PASSWORD)
                .locations("classpath:db/migration")
                .placeholders(PostgresContainerConfig.placeholders())
                .load()
                .migrate();
        app = jdbc(PostgresContainerConfig.RUNTIME_USER, PostgresContainerConfig.RUNTIME_PASSWORD);
        owner = jdbc(PostgresContainerConfig.MIGRATION_USER, PostgresContainerConfig.MIGRATION_PASSWORD);
        superuser = jdbc(POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    // ------------------------------------------------------------------ the runtime role

    @Test
    void theApplicationRoleIsNoSuperuserAndOwnsNothing() {
        assertThat(app.queryForObject("SELECT rolsuper FROM pg_roles WHERE rolname = current_user", Boolean.class))
                .isFalse();
        assertThat(app.queryForObject("""
                SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND pg_has_role(current_user, c.relowner, 'USAGE')
                """, Integer.class)).isZero();
        assertThat(new DatabaseRoleCheck(app).problems()).isEmpty();
        // The owner and the superuser would not pass the startup check.
        assertThat(new DatabaseRoleCheck(owner).problems()).anyMatch(p -> p.contains("owns seller_declarations"));
        assertThat(new DatabaseRoleCheck(superuser).problems()).anyMatch(p -> p.contains("superuser"));
        // No new objects in the schema.
        assertThatThrownBy(() -> app.execute("CREATE TABLE app_made (id INT)"))
                .isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("permission denied");
    }

    @Test
    void evidenceCanBeReadAndAppended() {
        Fixture f = fixture();
        assertThat(app.queryForObject("SELECT text FROM seller_declarations WHERE id = ?", String.class,
                f.declaration())).isEqualTo("I confirm");
        assertThat(app.queryForObject("SELECT action FROM audit_logs WHERE id = ?", String.class, f.audit()))
                .isEqualTo("DECLARATION_CONFIRMED");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "UPDATE seller_declarations SET text = 'changed' WHERE id = %d",
        "UPDATE seller_declarations SET ip_address = NULL WHERE id = %d",
        // Even the one change the database makes itself (account deletion) is not the application's to make.
        "UPDATE seller_declarations SET user_id = NULL WHERE id = %d",
        "DELETE FROM seller_declarations WHERE id = %d",
    })
    void theApplicationCannotChangeOrDeleteADeclaration(String statement) {
        Fixture f = fixture();
        assertThatThrownBy(() -> app.update(statement.formatted(f.declaration())))
                .isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("permission denied");
        assertThat(app.queryForObject("SELECT count(*) FROM seller_declarations WHERE id = ? AND text = 'I confirm'"
                + " AND user_id IS NOT NULL AND ip_address IS NOT NULL", Integer.class, f.declaration())).isOne();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "UPDATE audit_logs SET reason = 'changed' WHERE id = %d",
        "UPDATE audit_logs SET actor_id = NULL WHERE id = %d",
        "DELETE FROM audit_logs WHERE id = %d",
    })
    void theApplicationCannotChangeOrDeleteAnAuditRow(String statement) {
        Fixture f = fixture();
        assertThatThrownBy(() -> app.update(statement.formatted(f.audit())))
                .isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("permission denied");
        assertThat(app.queryForObject("SELECT count(*) FROM audit_logs WHERE id = ? AND reason = 'evidence'",
                Integer.class, f.audit())).isOne();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "TRUNCATE seller_declarations",
        "TRUNCATE seller_declarations, verification_documents CASCADE",
        "TRUNCATE stores CASCADE",
        "TRUNCATE users CASCADE",
        "TRUNCATE audit_logs",
        "ALTER TABLE seller_declarations DISABLE TRIGGER ALL",
        "ALTER TABLE seller_declarations DISABLE TRIGGER seller_declarations_append_only",
        "ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only",
        "DROP TRIGGER seller_declarations_append_only ON seller_declarations",
        "ALTER TABLE seller_declarations OWNER TO jeparla_app",
        "DROP TABLE audit_logs",
        "SET session_replication_role = replica",
    })
    void theApplicationCannotBypassTheTriggers(String statement) {
        Fixture f = fixture();
        // "permission denied" (no privilege) or "must be owner" (ALTER, DROP).
        assertThatThrownBy(() -> app.execute(statement)).isInstanceOf(DataAccessException.class)
                .satisfies(e -> assertThat(NestedExceptionUtils.getMostSpecificCause(e).getMessage()).containsAnyOf("permission denied", "must be owner"));
        assertThat(app.queryForObject("SELECT count(*) FROM seller_declarations WHERE id = ?", Integer.class,
                f.declaration())).isOne();
        assertThat(app.queryForObject("SELECT count(*) FROM audit_logs WHERE id = ?", Integer.class, f.audit()))
                .isOne();
        assertThat(app.queryForObject("SELECT count(*) FROM pg_trigger WHERE tgname IN"
                + " ('seller_declarations_append_only', 'audit_logs_append_only') AND tgenabled = 'O'", Integer.class))
                .isEqualTo(2);
    }

    @Test
    void replicationRoleCannotBeSetForASingleTransactionEither() {
        // The trick of the issue in one connection: switch triggers off, then delete. The first step fails.
        JdbcTemplate session = new JdbcTemplate(new SingleConnectionDataSource(POSTGRES.getJdbcUrl(),
                PostgresContainerConfig.RUNTIME_USER, PostgresContainerConfig.RUNTIME_PASSWORD, true));
        Fixture f = fixture();
        assertThatThrownBy(() -> session.execute("SET session_replication_role = replica"))
                .isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("permission denied");
        assertThat(session.queryForObject("SHOW session_replication_role", String.class)).isEqualTo("origin");
        assertThatThrownBy(() -> session.update("DELETE FROM seller_declarations WHERE id = ?", f.declaration()))
                .isInstanceOf(DataAccessException.class).rootCause().hasMessageContaining("permission denied");
        assertThat(session.queryForObject("SELECT count(*) FROM seller_declarations WHERE id = ?", Integer.class,
                f.declaration())).isOne();
    }

    // ------------------------------------------------------------------ account deletion

    @Test
    void deletingTheAccountOnlyClearsTheUserReference() {
        Fixture f = fixture();
        // The application deletes the account (it may DELETE users); ON DELETE SET NULL runs as the table owner
        // and the append-only triggers let exactly this change through.
        assertThat(app.update("DELETE FROM users WHERE id = ?", f.signer())).isOne();

        assertThat(app.queryForMap("SELECT user_id, user_label, text, host(ip_address) AS ip FROM seller_declarations"
                + " WHERE id = ?", f.declaration()))
                .containsEntry("user_id", null)
                .containsEntry("user_label", "Signer " + f.n())
                .containsEntry("text", "I confirm")
                .containsEntry("ip", "203.0.113.7");
        assertThat(app.queryForMap("SELECT actor_id, actor_label, reason FROM audit_logs WHERE id = ?", f.audit()))
                .containsEntry("actor_id", null)
                .containsEntry("actor_label", "Signer " + f.n())
                .containsEntry("reason", "evidence");
    }

    // ------------------------------------------------------------------ owner and retention

    @Test
    void theOwnerIsStoppedByTheTriggersToo() {
        Fixture f = fixture();
        assertThatThrownBy(() -> owner.execute("TRUNCATE seller_declarations CASCADE"))
                .rootCause().hasMessageContaining("never truncated");
        assertThatThrownBy(() -> owner.execute("TRUNCATE audit_logs"))
                .rootCause().hasMessageContaining("never truncated");
        assertThatThrownBy(() -> owner.update("UPDATE audit_logs SET reason = 'x' WHERE id = ?", f.audit()))
                .rootCause().hasMessageContaining("append-only");
        assertThatThrownBy(() -> owner.update("DELETE FROM audit_logs WHERE id = ?", f.audit()))
                .rootCause().hasMessageContaining("append-only");
        assertThatThrownBy(() -> owner.update("UPDATE seller_declarations SET text = 'x' WHERE id = ?",
                f.declaration())).rootCause().hasMessageContaining("append-only");
        // Retention shorter than 7 years (analysis.md section 5, V57) is refused.
        assertThatThrownBy(() -> owner.queryForObject("SELECT jeparla_purge_audit_logs(INTERVAL '6 years')",
                Long.class)).rootCause().hasMessageContaining("at least 7 years");
    }

    @Test
    void retentionRemovesOnlyRowsOlderThanTheFloor() {
        Fixture f = fixture();
        long old = superuser.queryForObject("""
                INSERT INTO audit_logs (actor_label, action, target_type, created_at)
                VALUES ('System', 'OLD_EVENT', 'STORE', now() - INTERVAL '8 years') RETURNING id
                """, Long.class);
        // Other tests leave old rows too (pseudonymisation), so at least this one.
        assertThat(owner.queryForObject("SELECT jeparla_purge_audit_logs(INTERVAL '7 years')", Long.class))
                .isPositive();
        assertThat(app.queryForObject("SELECT count(*) FROM audit_logs WHERE id = ?", Integer.class, old)).isZero();
        assertThat(app.queryForObject("SELECT count(*) FROM audit_logs WHERE id = ?", Integer.class, f.audit()))
                .isOne();
        // The flag the function sets does not open the table to a direct DELETE of a recent row.
        assertThatThrownBy(() -> owner.execute("SET jeparla.audit_purge = 'on'; DELETE FROM audit_logs WHERE id = "
                + f.audit())).rootCause().hasMessageContaining("append-only");
    }

    // ------------------------------------------------------------------ pseudonymisation (V56, #138)

    private static final String HASH = "hmac-sha256:" + "ab".repeat(32);

    /** A store that ended its relationship 8 years ago, with one 8-year-old declaration and its two audit rows. */
    private record OldEvidence(long store, long declaration, long declarationAudit, long uploadAudit) {
    }

    private static OldEvidence oldEvidence(String status) {
        int n = SEQ.incrementAndGet();
        long storeOwner = user("old-owner" + n);
        long store = app.queryForObject("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id, status)
                VALUES (?, ?, 'Old store', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890', ?)
                RETURNING id
                """, Long.class, storeOwner, "old-store-" + n, status);
        long declaration = app.queryForObject("""
                INSERT INTO seller_declarations (user_id, user_label, store_id, text_version, language, text,
                                                 ip_address, confirmed_at)
                VALUES (?, 'Old Signer <old@jeparla.test>', ?, 'test-1', 'en', 'I confirm', '203.0.113.9',
                        now() - INTERVAL '8 years')
                RETURNING id
                """, Long.class, storeOwner, store);
        String details = "{\"declarationId\":" + declaration + "}";
        long declarationAudit = app.queryForObject("""
                INSERT INTO audit_logs (actor_id, actor_label, actor_role, action, target_type, target_id, details,
                                        ip_address, created_at)
                VALUES (?, 'Old Signer <old@jeparla.test>', 'MERCHANT', 'DECLARATION_CONFIRMED', 'STORE', ?,
                        ?::jsonb, '203.0.113.9', now() - INTERVAL '8 years')
                RETURNING id
                """, Long.class, storeOwner, String.valueOf(store), details);
        long uploadAudit = app.queryForObject("""
                INSERT INTO audit_logs (actor_id, actor_label, actor_role, action, target_type, target_id, details,
                                        ip_address, created_at)
                VALUES (?, 'Old Signer <old@jeparla.test>', 'MERCHANT', 'DOCUMENT_UPLOADED', 'DOCUMENT', 'x',
                        ?::jsonb, '203.0.113.9', now() - INTERVAL '8 years')
                RETURNING id
                """, Long.class, storeOwner, details);
        app.update("UPDATE stores SET updated_at = now() - INTERVAL '8 years' WHERE id = ?", store);
        return new OldEvidence(store, declaration, declarationAudit, uploadAudit);
    }

    private static int pseudonymise(long declaration, String hash, int years) {
        return app.queryForObject("SELECT jeparla_pseudonymise_declaration(?, ?, ?)", Integer.class, declaration,
                hash, years);
    }

    @Test
    void aDueDeclarationLosesOnlyItsIpAndLabel() {
        OldEvidence e = oldEvidence("BLOCKED");

        assertThat(pseudonymise(e.declaration(), HASH, 7)).isEqualTo(3);

        assertThat(app.queryForMap("SELECT user_label, host(ip_address) AS ip, text, pseudonymised_at IS NOT NULL"
                + " AS done FROM seller_declarations WHERE id = ?", e.declaration()))
                .containsEntry("user_label", HASH).containsEntry("ip", null).containsEntry("text", "I confirm")
                .containsEntry("done", true);
        for (long audit : List.of(e.declarationAudit(), e.uploadAudit())) {
            assertThat(app.queryForMap("SELECT actor_label, host(ip_address) AS ip, details ->> 'declarationId' AS d"
                    + " FROM audit_logs WHERE id = ?", audit))
                    .containsEntry("actor_label", HASH).containsEntry("ip", null)
                    .containsEntry("d", String.valueOf(e.declaration()));
        }
        // Idempotent.
        assertThat(pseudonymise(e.declaration(), HASH, 7)).isZero();
    }

    @Test
    void declarationsThatAreNotDueStayAsTheyAre() {
        // The store is still selling.
        OldEvidence approved = oldEvidence("APPROVED");
        assertThat(pseudonymise(approved.declaration(), HASH, 7)).isZero();
        // Legal hold.
        OldEvidence held = oldEvidence("BLOCKED");
        app.update("UPDATE stores SET legal_hold_at = now(), legal_hold_reason = 'Request no. 12 of the court',"
                + " updated_at = now() - INTERVAL '8 years' WHERE id = ?", held.store());
        assertThat(pseudonymise(held.declaration(), HASH, 7)).isZero();
        // The store's relationship ended recently.
        OldEvidence recentlyBlocked = oldEvidence("BLOCKED");
        app.update("UPDATE stores SET updated_at = now() - INTERVAL '1 year' WHERE id = ?", recentlyBlocked.store());
        assertThat(pseudonymise(recentlyBlocked.declaration(), HASH, 7)).isZero();
        // A longer configured period.
        OldEvidence longer = oldEvidence("BLOCKED");
        assertThat(pseudonymise(longer.declaration(), HASH, 10)).isZero();

        for (OldEvidence e : List.of(approved, held, recentlyBlocked, longer)) {
            assertThat(app.queryForObject("SELECT host(ip_address) FROM seller_declarations WHERE id = ?",
                    String.class, e.declaration())).isEqualTo("203.0.113.9");
            assertThat(app.queryForObject("SELECT host(ip_address) FROM audit_logs WHERE id = ?", String.class,
                    e.declarationAudit())).isEqualTo("203.0.113.9");
        }
    }

    @Test
    void theFunctionRefusesAShortPeriodAndAnythingButAHash() {
        OldEvidence e = oldEvidence("BLOCKED");
        assertThatThrownBy(() -> pseudonymise(e.declaration(), HASH, 6)).rootCause()
                .hasMessageContaining("at least 7 years");
        assertThatThrownBy(() -> pseudonymise(e.declaration(), "Someone else <x@y.z>", 7)).rootCause()
                .hasMessageContaining("hmac-sha256");
    }

    @Test
    void theFlagDoesNotOpenTheTablesToADirectChange() {
        Fixture f = fixture();
        // The application still has no UPDATE on the evidence tables.
        assertThatThrownBy(() -> app.execute("SET jeparla.pseudonymise = 'on'; UPDATE seller_declarations SET"
                + " ip_address = NULL, user_label = '" + HASH + "', pseudonymised_at = now() WHERE id = "
                + f.declaration())).rootCause().hasMessageContaining("permission denied");
        // The owner is stopped by the trigger for a recent row.
        assertThatThrownBy(() -> owner.execute("SET jeparla.pseudonymise = 'on'; UPDATE seller_declarations SET"
                + " ip_address = NULL, user_label = '" + HASH + "', pseudonymised_at = now() WHERE id = "
                + f.declaration())).rootCause().hasMessageContaining("append-only");
        assertThatThrownBy(() -> owner.execute("SET jeparla.pseudonymise = 'on'; UPDATE audit_logs SET"
                + " ip_address = NULL, actor_label = '" + HASH + "' WHERE id = " + f.audit())).rootCause()
                .hasMessageContaining("append-only");
        // And for an old row, any change beyond the pseudonymisation.
        OldEvidence e = oldEvidence("BLOCKED");
        assertThatThrownBy(() -> owner.execute("SET jeparla.pseudonymise = 'on'; UPDATE seller_declarations SET"
                + " ip_address = NULL, user_label = '" + HASH + "', pseudonymised_at = now(), text = 'changed'"
                + " WHERE id = " + e.declaration())).rootCause().hasMessageContaining("append-only");
    }

    @Test
    void tablesOfLaterMigrationsAreGrantedToTheApplication() {
        owner.execute("CREATE TABLE later_table (id INT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY, note TEXT)");
        try {
            app.update("INSERT INTO later_table (note) VALUES ('x')");
            assertThat(app.update("UPDATE later_table SET note = 'y'")).isOne();
            assertThat(app.update("DELETE FROM later_table")).isOne();
            assertThatThrownBy(() -> app.execute("TRUNCATE later_table")).rootCause().hasMessageContaining("permission denied");
        } finally {
            owner.execute("DROP TABLE later_table");
        }
    }

    // ------------------------------------------------------------------ fixtures

    /** A store, a second user who signed a declaration for it, and an audit row of that user. */
    private record Fixture(int n, long signer, long declaration, long audit) {
    }

    private static Fixture fixture() {
        int n = SEQ.incrementAndGet();
        long storeOwner = user("owner" + n);
        long signer = user("signer" + n);
        long store = app.queryForObject("""
                INSERT INTO stores (owner_id, slug, name, city, address, whatsapp, legal_type, tax_id)
                VALUES (?, ?, 'Store', 'Baku', 'Nizami 1', '+994501234567', 'COMPANY', '1234567890')
                RETURNING id
                """, Long.class, storeOwner, "evidence-store-" + n);
        long declaration = app.queryForObject("""
                INSERT INTO seller_declarations (user_id, user_label, store_id, text_version, language, text,
                                                 ip_address, confirmed_at)
                VALUES (?, ?, ?, 'test-1', 'en', 'I confirm', '203.0.113.7', now())
                RETURNING id
                """, Long.class, signer, "Signer " + n, store);
        long audit = app.queryForObject("""
                INSERT INTO audit_logs (actor_id, actor_label, actor_role, action, target_type, target_id, reason)
                VALUES (?, ?, 'MERCHANT', 'DECLARATION_CONFIRMED', 'STORE', ?, 'evidence')
                RETURNING id
                """, Long.class, signer, "Signer " + n, String.valueOf(store));
        return new Fixture(n, signer, declaration, audit);
    }

    private static long user(String name) {
        return app.queryForObject("""
                INSERT INTO users (email, password_hash, display_name) VALUES (?, 'x', ?) RETURNING id
                """, Long.class, name + "@jeparla.test", name);
    }

    private static JdbcTemplate jdbc(String user, String password) {
        return new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), user, password));
    }
}
