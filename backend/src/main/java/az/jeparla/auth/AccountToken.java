package az.jeparla.auth;

import az.jeparla.common.persistence.LongIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A one-time account token (table {@code account_tokens}, V19): email verification or password reset (#131).
 * Only the SHA-256 hash is stored. It works once and only before {@link #getExpiresAt()}.
 */
@Entity
@Table(name = "account_tokens")
public class AccountToken extends LongIdEntity {

    /** What a token is for. */
    public enum Purpose {
        EMAIL_VERIFICATION,
        PASSWORD_RESET
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, updatable = false)
    private Purpose purpose;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false)
    private String tokenHash;

    /** The address the link went to; null for a reset link an admin issued for a phone-only account. */
    @Column(name = "email", updatable = false)
    private String email;

    /** Id of the admin who issued the link, or null. */
    @Column(name = "issued_by", updatable = false)
    private Long issuedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    protected AccountToken() {
    }

    AccountToken(User user, Purpose purpose, String tokenHash, String email, Long issuedBy, Instant createdAt,
            Instant expiresAt) {
        this.user = user;
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.email = email;
        this.issuedBy = issuedBy;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    /** Not used yet and not expired. */
    boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    void markUsed(Instant now) {
        this.usedAt = now;
    }

    public User getUser() {
        return user;
    }

    public Purpose getPurpose() {
        return purpose;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public String getEmail() {
        return email;
    }

    public Long getIssuedBy() {
        return issuedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }
}
