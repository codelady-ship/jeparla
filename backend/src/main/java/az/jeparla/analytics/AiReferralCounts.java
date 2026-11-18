package az.jeparla.analytics;

import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Daily AI referral counters ({@code ai_referral_counts}, V62). One atomic upsert per visit; only the counters are
 * stored.
 */
@Repository
public class AiReferralCounts {

    /** One row of the table. */
    public record Row(LocalDate day, AiSource source, LandingPage page, long visits) {
    }

    private final JdbcTemplate jdbc;

    public AiReferralCounts(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void addVisit(LocalDate day, AiSource source, LandingPage page) {
        jdbc.update("""
                INSERT INTO ai_referral_counts (day, source, page, visits) VALUES (?, ?, ?, 1)
                ON CONFLICT (day, source, page) DO UPDATE SET visits = ai_referral_counts.visits + 1
                """, day, source.name(), page.name());
    }

    /** Counters from {@code from} to {@code to} (both included), oldest day first. */
    public List<Row> between(LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT day, source, page, visits FROM ai_referral_counts
                WHERE day BETWEEN ? AND ? ORDER BY day, source, page
                """, (rs, i) -> new Row(rs.getObject("day", LocalDate.class), AiSource.valueOf(rs.getString("source")),
                        LandingPage.valueOf(rs.getString("page")), rs.getLong("visits")),
                from, to);
    }
}
