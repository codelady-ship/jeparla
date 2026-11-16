package az.jeparla.verification;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Database side of the declaration pseudonymisation (#138). The runtime role only reads here; the change itself
 * is {@code jeparla_pseudonymise_declaration} (V56), which re-checks every condition and is the only way to
 * modify the evidence tables.
 */
@Repository
public class DeclarationRetentionStore {

    /** A declaration due for pseudonymisation and its current label. */
    public record Candidate(long id, String userLabel) {
    }

    // Same conditions as the database function; the function is the authority, this only finds the rows.
    private static final String DUE = """
            SELECT d.id, d.user_label
            FROM seller_declarations d
                     JOIN stores s ON s.id = d.store_id
            WHERE d.pseudonymised_at IS NULL
              AND d.confirmed_at < now() - make_interval(years => ?)
              AND s.legal_hold_at IS NULL
              AND s.status <> 'APPROVED'
              AND s.updated_at < now() - make_interval(years => ?)
              AND NOT EXISTS (SELECT 1 FROM seller_declarations newer
                              WHERE newer.store_id = d.store_id
                                AND newer.confirmed_at >= now() - make_interval(years => ?))
              AND d.id > ?
            ORDER BY d.id
            LIMIT ?
            """;

    private final JdbcTemplate jdbc;

    public DeclarationRetentionStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Up to {@code limit} due declarations with an id greater than {@code afterId}, by id. */
    public List<Candidate> due(int years, long afterId, int limit) {
        return jdbc.query(DUE, (rs, i) -> new Candidate(rs.getLong(1), rs.getString(2)), years, years, years,
                afterId, limit);
    }

    /** Pseudonymises one declaration and its audit rows; the number of rows changed (0 when not due). */
    public int pseudonymise(long id, String labelHash, int years) {
        Integer changed = jdbc.queryForObject("SELECT jeparla_pseudonymise_declaration(?, ?, ?)", Integer.class,
                id, labelHash, years);
        return changed == null ? 0 : changed;
    }
}
