package az.jeparla.admin.dto;

import az.jeparla.auth.RoleName;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Sets the role of an account (#40): USER or MERCHANT. ADMIN is never granted through the API (docs/RBAC.md:
 * admins are created in the database), so {@code ADMIN} answers 400 {@code admin.role_not_assignable}; an admin can
 * be demoted, but not themself (409 {@code admin.self}) and not the last active admin (409 {@code admin.last_admin}).
 * The new role reaches the user's token at the next refresh (at most 15 minutes).
 *
 * @param reason optional note for the audit log
 */
@Schema(name = "UserRoleRequest", requiredProperties = {"role"})
public record UserRoleRequest(@NotNull RoleName role, @Size(max = 1000) String reason) {
}
