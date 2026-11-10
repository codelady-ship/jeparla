package az.jeparla.support;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * The container's superuser, for test fixtures the application itself must never be able to do (#165): emptying
 * tables between tests, adding a failing trigger. Not a {@code JdbcTemplate} bean on purpose: the application's
 * {@code JdbcTemplate} stays the runtime role's.
 */
public class DatabaseSuperuser {

    private final PostgreSQLContainer postgres;
    private JdbcTemplate jdbc;

    DatabaseSuperuser(PostgreSQLContainer postgres) {
        this.postgres = postgres;
    }

    /** A new connection per statement, as the superuser. */
    public synchronized JdbcTemplate jdbc() {
        if (jdbc == null) {
            jdbc = new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(),
                    postgres.getPassword()));
        }
        return jdbc;
    }

    /**
     * Empties tables, the evidence tables included: only a superuser can, by switching triggers off for the
     * session ({@code session_replication_role}), which the runtime role is not allowed to do.
     */
    public void truncate(String tables) {
        jdbc().execute("SET session_replication_role = replica; TRUNCATE " + tables + " CASCADE;"
                + " RESET session_replication_role");
    }
}
