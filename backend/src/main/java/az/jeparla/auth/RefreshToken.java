package az.jeparla.auth;

import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A refresh token (table {@code refresh_tokens}, V8). Only the SHA-256 hash is stored. Tokens of
 * one login form a family: a refresh marks the presented token used and issues the next one in the
 * same family.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Column(name = "family_id", nullable = false, updatable = false)
    private UUID familyId;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    /** End of the whole family (V18, #134): the same on every token of the family, set at login. */
    @Column(name = "family_expires_at", nullable = false, updatable = false)
    private Instant familyExpiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected RefreshToken() {
    }

    /**
     * @param expiresAt       end of this token, never after {@code familyExpiresAt}
     * @param familyExpiresAt end of the family
     */
    public RefreshToken(User user, UUID familyId, String tokenHash, Instant expiresAt, Instant familyExpiresAt) {
        if (expiresAt.isAfter(familyExpiresAt)) {
            throw new IllegalArgumentException("A refresh token cannot outlive its family");
        }
        this.user = user;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.familyExpiresAt = familyExpiresAt;
    }

    /** Used (already exchanged) or revoked: presenting it again is reuse. */
    public boolean isSpent() {
        return usedAt != null || revokedAt != null;
    }

    /** The token or its whole family has expired. */
    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now) || !familyExpiresAt.isAfter(now);
    }

    public Instant getFamilyExpiresAt() {
        return familyExpiresAt;
    }

    public void markUsed(Instant now) {
        this.usedAt = now;
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            this.revokedAt = now;
        }
    }

    public User getUser() {
        return user;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }
}
