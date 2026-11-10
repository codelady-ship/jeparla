package az.jeparla.common.persistence;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Refuses to run the API with a database role that could change or remove evidence (#165): the runtime role
 * ({@code JEPARLA_DB_USER}) must not be a superuser, must not own (or be a member of the owner of) the
 * evidence tables, and may only read and insert their rows. The grants come from migration V16; a deployment
 * that still connects as the table owner or as the image's superuser stops here with the reason, instead of
 * running with the append-only triggers one {@code ALTER TABLE} or {@code session_replication_role} away.
 */
@Component
public class DatabaseRoleCheck implements ApplicationRunner {

    /** Tables kept as legal evidence (docs/legal/sellers-liability.md 3.3). */
    public static final List<String> EVIDENCE_TABLES = List.of("seller_declarations", "audit_logs");

    private static final Logger log = LoggerFactory.getLogger(DatabaseRoleCheck.class);

    private static final String QUERY = """
            SELECT current_user AS name, r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
                   pg_has_role(current_user, c.relowner, 'USAGE') AS owner,
                   has_table_privilege(c.oid, 'UPDATE') AS can_update,
                   has_table_privilege(c.oid, 'DELETE') AS can_delete,
                   has_table_privilege(c.oid, 'TRUNCATE') AS can_truncate,
                   has_table_privilege(c.oid, 'TRIGGER') AS can_trigger
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_roles r ON r.rolname = current_user
            WHERE n.nspname = current_schema() AND c.relname = ?
            """;

    private final JdbcTemplate jdbc;

    public DatabaseRoleCheck(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> problems = problems();
        if (!problems.isEmpty()) {
            throw new IllegalStateException("The API database role has more rights than it may have (#165, "
                    + "backend/README.md \"Verilənlər bazası rolları\"): " + String.join("; ", problems));
        }
        log.info("Database runtime role checked: no superuser, no owner, evidence tables are insert-only");
    }

    /** Everything wrong with the current role; empty when it is the least-privilege runtime role. */
    public List<String> problems() {
        List<String> problems = new ArrayList<>();
        for (String table : EVIDENCE_TABLES) {
            List<Map<String, Object>> rows = jdbc.queryForList(QUERY, table);
            if (rows.isEmpty()) {
                problems.add(table + " is missing");
                continue;
            }
            Map<String, Object> row = rows.getFirst();
            String role = (String) row.get("name");
            if (Boolean.TRUE.equals(row.get("superuser")) || Boolean.TRUE.equals(row.get("bypass_rls"))) {
                problems.add("role " + role + " is a superuser or bypasses row security");
            }
            if (Boolean.TRUE.equals(row.get("owner"))) {
                problems.add("role " + role + " owns " + table + " (use the migration role only for Flyway)");
            }
            for (String privilege : List.of("update", "delete", "truncate", "trigger")) {
                if (Boolean.TRUE.equals(row.get("can_" + privilege))) {
                    problems.add("role " + role + " may " + privilege.toUpperCase(Locale.ROOT) + " " + table);
                }
            }
        }
        return problems.stream().distinct().toList();
    }
}
