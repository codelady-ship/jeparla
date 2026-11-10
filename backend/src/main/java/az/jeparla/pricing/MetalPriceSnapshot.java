package az.jeparla.pricing;

import static az.jeparla.common.persistence.Decimals.percent;
import static az.jeparla.common.persistence.Decimals.quote;

import az.jeparla.auth.User;
import az.jeparla.common.Currencies;
import az.jeparla.common.persistence.CreatedEntity;
import az.jeparla.product.Metal;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Currency;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Daily CBAR metal quote (PLAN 5.10, #43): AZN per troy ounce and per gram
 * ({@code NUMERIC(14,4)}). One CBAR row per metal and business date (partial unique index
 * {@code metal_price_snapshots_metal_date_source_key}, V12); ADMIN overrides may repeat on a day,
 * the newest one wins. Only APPLIED quotes price products.
 */
@Entity
@Table(name = "metal_price_snapshots")
public class MetalPriceSnapshot extends CreatedEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "metal", nullable = false, updatable = false)
    private Metal metal;

    /** Business date of the quote; weekends and holidays keep the last available date. */
    @Column(name = "quote_date", nullable = false, updatable = false)
    private LocalDate quoteDate;

    @Column(name = "price_per_ounce", nullable = false, precision = 14, scale = 4, updatable = false)
    private BigDecimal pricePerOunce;

    @Column(name = "price_per_gram", nullable = false, precision = 14, scale = 4, updatable = false)
    private BigDecimal pricePerGram;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3, updatable = false)
    private Currency currency = Currencies.AZN;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, updatable = false)
    private QuoteSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private QuoteStatus status = QuoteStatus.APPLIED;

    /** Percent change against the quote in use, e.g. 12.40. */
    @Column(name = "change_percent", precision = 7, scale = 2)
    private BigDecimal changePercent;

    @Column(name = "fetched_at", nullable = false, updatable = false)
    private Instant fetchedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "note")
    private String note;

    protected MetalPriceSnapshot() {
    }

    /**
     * @param pricePerGram computed by the caller: {@code pricePerOunce / 31.1034768}, 4 decimals
     *                     half up (the same rule as frontend/src/lib/pricing.ts)
     */
    public MetalPriceSnapshot(Metal metal, LocalDate quoteDate, BigDecimal pricePerOunce, BigDecimal pricePerGram,
            QuoteSource source, Instant fetchedAt) {
        this.metal = metal;
        this.quoteDate = quoteDate;
        this.pricePerOunce = quote(pricePerOunce);
        this.pricePerGram = quote(pricePerGram);
        this.source = source;
        this.fetchedAt = fetchedAt;
    }

    /** Held by the sanity check: waits for an admin. */
    public void hold(BigDecimal changePercent) {
        this.status = QuoteStatus.HELD;
        this.changePercent = percent(changePercent);
    }

    /** Admin decision on a HELD quote. */
    public void decide(QuoteStatus decision, User admin, String note, Instant now) {
        this.status = decision;
        this.decidedBy = admin;
        this.note = note;
        this.decidedAt = now;
    }

    public Metal getMetal() {
        return metal;
    }

    public LocalDate getQuoteDate() {
        return quoteDate;
    }

    public BigDecimal getPricePerOunce() {
        return pricePerOunce;
    }

    public BigDecimal getPricePerGram() {
        return pricePerGram;
    }

    public Currency getCurrency() {
        return currency;
    }

    public QuoteSource getSource() {
        return source;
    }

    public QuoteStatus getStatus() {
        return status;
    }

    public BigDecimal getChangePercent() {
        return changePercent;
    }

    public void setChangePercent(BigDecimal changePercent) {
        this.changePercent = percent(changePercent);
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }

    public User getDecidedBy() {
        return decidedBy;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public String getNote() {
        return note;
    }
}
