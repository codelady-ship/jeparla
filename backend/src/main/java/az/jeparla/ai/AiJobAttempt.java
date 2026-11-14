package az.jeparla.ai;

import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Currency;

/** One call to the provider (#55, V40): who ran it, how it ended and what it cost. */
@Entity
@Table(name = "ai_job_attempts")
public class AiJobAttempt extends LongIdEntity {

    @Column(name = "job_id", nullable = false, updatable = false)
    private Long jobId;

    @Column(name = "number", nullable = false, updatable = false)
    private int number;

    @Column(name = "provider", nullable = false, updatable = false)
    private String provider;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "outcome")
    private String outcome;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "cost", nullable = false, precision = 12, scale = 4)
    private BigDecimal cost;

    @Column(name = "currency", nullable = false, length = 3, updatable = false)
    private Currency currency;

    protected AiJobAttempt() {
    }

    AiJobAttempt(long jobId, int number, String provider, BigDecimal estimatedCost, Currency currency, Instant now) {
        this.jobId = jobId;
        this.number = number;
        this.provider = provider;
        this.cost = estimatedCost;
        this.currency = currency;
        this.startedAt = now;
    }

    void succeeded(BigDecimal actualCost, Instant now) {
        if (actualCost != null) {
            cost = actualCost;
        }
        outcome = "SUCCEEDED";
        finishedAt = now;
    }

    void failed(String code, Instant now) {
        outcome = "FAILED";
        errorCode = code;
        finishedAt = now;
    }

    long getJobId() {
        return jobId;
    }

    BigDecimal getCost() {
        return cost;
    }

    Instant getFinishedAt() {
        return finishedAt;
    }
}
