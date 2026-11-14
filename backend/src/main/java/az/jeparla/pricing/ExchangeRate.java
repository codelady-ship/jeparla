package az.jeparla.pricing;

import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Daily CBAR rate of a display currency (#53): AZN per one USD or EUR ({@code NUMERIC(12,6)}), one row per
 * currency and bulletin date. Display only: prices stay in AZN, a converted price is approximate.
 */
@Entity
@Table(name = "exchange_rates")
public class ExchangeRate extends CreatedEntity {

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3, updatable = false)
    private String currency;

    @Column(name = "rate_date", nullable = false, updatable = false)
    private LocalDate rateDate;

    @Column(name = "azn_per_unit", nullable = false, precision = 12, scale = 6, updatable = false)
    private BigDecimal aznPerUnit;

    @Column(name = "fetched_at", nullable = false, updatable = false)
    private Instant fetchedAt;

    protected ExchangeRate() {
    }

    public ExchangeRate(String currency, LocalDate rateDate, BigDecimal aznPerUnit, Instant fetchedAt) {
        this.currency = currency;
        this.rateDate = rateDate;
        this.aznPerUnit = aznPerUnit;
        this.fetchedAt = fetchedAt;
    }

    public String getCurrency() {
        return currency;
    }

    public LocalDate getRateDate() {
        return rateDate;
    }

    public BigDecimal getAznPerUnit() {
        return aznPerUnit;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }
}
