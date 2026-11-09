package az.jeparla.admin;

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
import java.net.InetAddress;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * An admin or merchant action (#34, #40). Append-only. {@code details} is JSON text for extra
 * context and must never hold passwords, tokens or document contents.
 */
@Entity
@Immutable
@Table(name = "audit_logs")
public class AuditLog extends CreatedEntity {

    /** NULL after the account is deleted; {@link #actorLabel} keeps who it was. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(name = "actor_label", nullable = false)
    private String actorLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_role")
    private ActorRole actorRole;

    /** Short action code, e.g. STORE_APPROVED (1..64 characters). */
    @Column(name = "action", nullable = false)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false)
    private AuditTargetType targetType;

    /** BIGINT or UUID of the target, as text. */
    @Column(name = "target_id")
    private String targetId;

    @Column(name = "target_name")
    private String targetName;

    @Column(name = "reason")
    private String reason;

    /** JSON object as text ({@code JSONB}). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details")
    private String details;

    @JdbcTypeCode(SqlTypes.INET)
    @Column(name = "ip_address")
    private InetAddress ipAddress;

    protected AuditLog() {
    }

    public AuditLog(User actor, String actorLabel, ActorRole actorRole, String action, AuditTargetType targetType,
            String targetId, String targetName) {
        this.actor = actor;
        this.actorLabel = actorLabel;
        this.actorRole = actorRole;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.targetName = targetName;
    }

    /** Optional context, set before the entry is saved. */
    public AuditLog withContext(String reason, String detailsJson, InetAddress ipAddress) {
        this.reason = reason;
        this.details = detailsJson;
        this.ipAddress = ipAddress;
        return this;
    }

    public User getActor() {
        return actor;
    }

    public String getActorLabel() {
        return actorLabel;
    }

    public ActorRole getActorRole() {
        return actorRole;
    }

    public String getAction() {
        return action;
    }

    public AuditTargetType getTargetType() {
        return targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public String getTargetName() {
        return targetName;
    }

    public String getReason() {
        return reason;
    }

    public String getDetails() {
        return details;
    }

    public InetAddress getIpAddress() {
        return ipAddress;
    }
}
