package az.jeparla.admin;

import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.RoleName;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.net.IpAddresses;
import java.net.InetAddress;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Writes the audit log for admin and merchant actions (PLAN 5.8, 5.13). The actor, their role and
 * the client IP come from the current request; callers name the action and its target.
 *
 * <p>Runs in the caller's transaction ({@link Propagation#MANDATORY}): the entry is saved only
 * when the audited change is committed, and an action cannot be logged without one.
 *
 * <p>Never put passwords, tokens or document contents into {@code reason} or {@code detailsJson}.
 */
@Service
public class AuditService {

    private final AuditLogRepository auditLogs;
    private final UserRepository users;

    public AuditService(AuditLogRepository auditLogs, UserRepository users) {
        this.auditLogs = auditLogs;
        this.users = users;
    }

    /**
     * @param action      short code, e.g. {@code STORE_APPROVED}, {@code PRODUCT_UPDATED}
     * @param targetType  what changed
     * @param targetId    its id
     * @param targetName  readable name kept with the entry (the target may change later)
     * @param reason      optional reason (moderation decisions)
     * @param detailsJson optional JSON object with extra context, or null
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog record(String action, AuditTargetType targetType, Object targetId, String targetName,
            String reason, String detailsJson) {
        User actor = CurrentUser.idIfPresent().flatMap(users::findById).orElse(null);
        String label = actor == null ? "system" : actorLabel(actor);
        AuditLog entry = new AuditLog(actor, label, actorRole(actor), action, targetType,
                targetId == null ? null : String.valueOf(targetId), targetName)
                .withContext(reason, detailsJson, clientIp());
        return auditLogs.save(entry);
    }

    private static String actorLabel(User user) {
        String contact = user.getEmail() != null ? user.getEmail() : user.getPhone();
        return user.getDisplayName() + " <" + contact + ">";
    }

    private static ActorRole actorRole(User actor) {
        if (actor == null) {
            return ActorRole.SYSTEM;
        }
        if (CurrentUser.hasRole(RoleName.ADMIN)) {
            return ActorRole.ADMIN;
        }
        if (CurrentUser.hasRole(RoleName.MERCHANT)) {
            return ActorRole.MERCHANT;
        }
        return ActorRole.USER;
    }

    /**
     * The client address set by {@code ClientIpFilter} (proxy-verified). Parsed as an IP literal
     * only: anything else (e.g. the host name {@code face.cafe}) is stored as null, and nothing is
     * ever looked up in DNS.
     */
    private static InetAddress clientIp() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servlet)) {
            return null;
        }
        return IpAddresses.parse(servlet.getRequest().getRemoteAddr());
    }
}
