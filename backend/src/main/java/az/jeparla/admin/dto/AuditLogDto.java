package az.jeparla.admin.dto;

import az.jeparla.admin.ActorRole;
import az.jeparla.admin.AuditLog;
import az.jeparla.admin.AuditTargetType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** One audit log entry (#40), read-only. */
@Schema(name = "AuditLogEntry", requiredProperties = {"id", "actorLabel", "action", "targetType", "createdAt"})
public record AuditLogDto(long id, String actorLabel, ActorRole actorRole, String action, AuditTargetType targetType,
        String targetId, String targetName, String reason, String details, String ipAddress, Instant createdAt) {

    public static AuditLogDto of(AuditLog entry) {
        return new AuditLogDto(entry.getId(), entry.getActorLabel(), entry.getActorRole(), entry.getAction(),
                entry.getTargetType(), entry.getTargetId(), entry.getTargetName(), entry.getReason(), entry.getDetails(),
                entry.getIpAddress() == null ? null : entry.getIpAddress().getHostAddress(), entry.getCreatedAt());
    }
}
