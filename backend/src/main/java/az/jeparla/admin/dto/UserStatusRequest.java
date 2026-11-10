package az.jeparla.admin.dto;

import az.jeparla.auth.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Blocks or unblocks an account (#40). BLOCKED needs a reason (10-1000 characters) for the audit log; the account's
 * sessions end at once (refresh tokens revoked, {@code GET /auth/me} 401) and its access token expires within 15
 * minutes. An admin cannot block themself (409 {@code admin.self}) or the last active admin (409
 * {@code admin.last_admin}). Blocking an account does not hide its store: block the store separately.
 */
@Schema(name = "UserStatusRequest", requiredProperties = {"status"})
public record UserStatusRequest(@NotNull UserStatus status, @Size(max = 1000) String reason) {
}
