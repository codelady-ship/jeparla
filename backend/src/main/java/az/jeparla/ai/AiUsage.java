package az.jeparla.ai;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * {@code ai_usage} (#55, V40): queued attempts and provider cost per store and day. Plain SQL upserts: one row
 * per store and day, changed by increments only. Call inside a transaction.
 */
@Component
class AiUsage {

    /** Advisory lock key of the monthly cost check: workers on several instances take turns. */
    private static final long COST_LOCK = 0x41495F434F5354L;

    private final JdbcTemplate jdbc;

    AiUsage(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    int attempts(long storeId, LocalDate day) {
        Integer n = jdbc.queryForObject("SELECT COALESCE(SUM(attempts), 0) FROM ai_usage WHERE store_id = ? AND"
                + " usage_date = ?", Integer.class, storeId, day);
        return n == null ? 0 : n;
    }

    void addAttempt(long storeId, LocalDate day, String currency) {
        jdbc.update("INSERT INTO ai_usage (store_id, usage_date, attempts, cost, currency) VALUES (?, ?, 1, 0, ?)"
                + " ON CONFLICT (store_id, usage_date) DO UPDATE SET attempts = ai_usage.attempts + 1",
                storeId, day, currency);
    }

    void addCost(long storeId, LocalDate day, BigDecimal cost, String currency) {
        if (cost.signum() == 0) {
            return;
        }
        jdbc.update("INSERT INTO ai_usage (store_id, usage_date, attempts, cost, currency) VALUES (?, ?, 0, ?, ?)"
                + " ON CONFLICT (store_id, usage_date) DO UPDATE SET cost = GREATEST(ai_usage.cost + EXCLUDED.cost, 0)",
                storeId, day, cost, currency);
    }

    /** Cost of all stores in {@code month}. */
    BigDecimal monthCost(YearMonth month) {
        BigDecimal sum = jdbc.queryForObject("SELECT COALESCE(SUM(cost), 0) FROM ai_usage WHERE usage_date BETWEEN ?"
                + " AND ?", BigDecimal.class, month.atDay(1), month.atEndOfMonth());
        return sum == null ? BigDecimal.ZERO : sum;
    }

    /** Serializes the monthly cost check until the end of the transaction. */
    void lockCost() {
        jdbc.queryForList("SELECT pg_advisory_xact_lock(?)", COST_LOCK);
    }
}
