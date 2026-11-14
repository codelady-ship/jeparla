package az.jeparla.share;

import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Daily referral counters per store and source ({@code store_referral_counts}, V20). Every count is one atomic
 * {@code INSERT ... ON CONFLICT DO UPDATE}, so concurrent visits never lose one. Nothing but the counters is
 * stored: no address, no user agent, no visitor.
 */
@Repository
public class ReferralCounts {

    /** One row of the table. */
    public record Row(LocalDate day, ReferralSource source, long visits, long whatsappClicks) {
    }

    private final JdbcTemplate jdbc;

    public ReferralCounts(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Adds one visit. */
    public void addVisit(long storeId, LocalDate day, ReferralSource source) {
        jdbc.update("""
                INSERT INTO store_referral_counts (store_id, day, source, visits) VALUES (?, ?, ?, 1)
                ON CONFLICT (store_id, day, source) DO UPDATE SET visits = store_referral_counts.visits + 1
                """, storeId, day, source.name());
    }

    /** Adds one WhatsApp click of a visitor who came through a shared link. */
    public void addWhatsappClick(long storeId, LocalDate day, ReferralSource source) {
        jdbc.update("""
                INSERT INTO store_referral_counts (store_id, day, source, whatsapp_clicks) VALUES (?, ?, ?, 1)
                ON CONFLICT (store_id, day, source)
                    DO UPDATE SET whatsapp_clicks = store_referral_counts.whatsapp_clicks + 1
                """, storeId, day, source.name());
    }

    /** Counters of one store from {@code from} to {@code to} (both included), oldest day first. */
    public List<Row> of(long storeId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT day, source, visits, whatsapp_clicks FROM store_referral_counts
                WHERE store_id = ? AND day BETWEEN ? AND ? ORDER BY day, source
                """, (rs, i) -> new Row(rs.getObject("day", LocalDate.class),
                        ReferralSource.valueOf(rs.getString("source")), rs.getLong("visits"),
                        rs.getLong("whatsapp_clicks")),
                storeId, from, to);
    }
}
