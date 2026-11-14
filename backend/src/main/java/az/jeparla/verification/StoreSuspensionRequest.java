package az.jeparla.verification;

import az.jeparla.auth.User;
import az.jeparla.common.persistence.LongIdEntity;
import az.jeparla.store.Store;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * A request to suspend a store because a document is suspected to be forged (#138, V22). One admin opens it by
 * rejecting a document for {@link RejectReason#AUTHENTICITY}; a different admin confirms or dismisses it (four
 * eyes, docs/legal/sellers-liability.md 3.1). Nobody can suspend a store alone.
 */
@Entity
@Table(name = "store_suspension_requests")
public class StoreSuspensionRequest extends LongIdEntity {

    public enum Status {
        PENDING,
        CONFIRMED,
        DISMISSED
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "store_id", nullable = false, updatable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", updatable = false)
    private VerificationDocument document;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", updatable = false)
    private User requestedBy;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private Instant requestedAt;

    @Column(name = "note", updatable = false)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decision_note")
    private String decisionNote;

    protected StoreSuspensionRequest() {
    }

    public StoreSuspensionRequest(Store store, VerificationDocument document, User requestedBy, String note,
            Instant requestedAt) {
        this.store = Objects.requireNonNull(store, "store");
        this.document = document;
        this.requestedBy = Objects.requireNonNull(requestedBy, "requestedBy");
        this.note = note;
        this.requestedAt = Objects.requireNonNull(requestedAt, "requestedAt");
    }

    /** Confirms or dismisses a PENDING request; the database also refuses a decision by the requester. */
    public void decide(boolean confirm, User admin, String decisionNote, Instant now) {
        if (status != Status.PENDING) {
            throw new IllegalStateException("Suspension request " + getId() + " is already " + status);
        }
        if (requestedBy != null && requestedBy.getId().equals(admin.getId())) {
            throw new IllegalArgumentException("The requester cannot decide their own suspension request");
        }
        this.status = confirm ? Status.CONFIRMED : Status.DISMISSED;
        this.decidedBy = admin;
        this.decisionNote = decisionNote;
        this.decidedAt = now;
    }

    /** Whether {@code userId} opened this request (the requester never decides it). */
    public boolean isRequestedBy(Long userId) {
        return requestedBy != null && requestedBy.getId().equals(userId);
    }

    public Store getStore() {
        return store;
    }

    public VerificationDocument getDocument() {
        return document;
    }

    public Status getStatus() {
        return status;
    }

    public User getRequestedBy() {
        return requestedBy;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public String getNote() {
        return note;
    }

    public User getDecidedBy() {
        return decidedBy;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public String getDecisionNote() {
        return decisionNote;
    }
}
