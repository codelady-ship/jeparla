package az.jeparla.product;

import az.jeparla.auth.User;
import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** A buyer complaint about a product (PLAN 5.8). Guests can report: the reporter is optional. */
@Entity
@Table(name = "product_reports")
public class ProductReport extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", updatable = false)
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, updatable = false)
    private ReportReason reason;

    /** Up to 2000 characters; empty when the buyer wrote nothing. */
    @Column(name = "message", nullable = false, updatable = false)
    private String message = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ReportStatus status = ReportStatus.OPEN;

    @Column(name = "resolution_note")
    private String resolutionNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected ProductReport() {
    }

    public ProductReport(Product product, User reporter, ReportReason reason, String message) {
        this.product = product;
        this.reporter = reporter;
        this.reason = reason;
        this.message = message == null ? "" : message;
    }

    /** Admin closes the report as RESOLVED or DISMISSED. */
    public void close(ReportStatus outcome, String note, User admin, Instant now) {
        if (outcome == ReportStatus.OPEN) {
            throw new IllegalArgumentException("A report is closed as RESOLVED or DISMISSED");
        }
        this.status = outcome;
        this.resolutionNote = note;
        this.resolvedBy = admin;
        this.resolvedAt = now;
    }

    public Product getProduct() {
        return product;
    }

    public User getReporter() {
        return reporter;
    }

    public ReportReason getReason() {
        return reason;
    }

    public String getMessage() {
        return message;
    }

    public ReportStatus getStatus() {
        return status;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public User getResolvedBy() {
        return resolvedBy;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }
}
