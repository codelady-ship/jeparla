package az.jeparla.admin.dto;

import az.jeparla.auth.Role;
import az.jeparla.auth.RoleName;
import az.jeparla.auth.User;
import az.jeparla.auth.UserStatus;
import az.jeparla.store.Store;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * An account in the admin user list (#40, PLAN 5.8). No password hash, no tokens.
 *
 * @param roles     roles stored for the account; ADMIN and MERCHANT also act as USER (role hierarchy), and an
 *                  account without a stored role is a plain USER
 * @param storeId   the store a seller owns, or null
 * @param storeName its name, or null
 */
@Schema(name = "AdminUser", requiredProperties = {
        "id", "displayName", "roles", "status", "emailVerified", "phoneVerified", "createdAt"})
public record AdminUserDto(long id, String displayName, @Schema(nullable = true) String email,
        @Schema(nullable = true, example = "+994501234567") String phone, List<RoleName> roles, UserStatus status,
        boolean emailVerified, boolean phoneVerified, @Schema(nullable = true) Long storeId,
        @Schema(nullable = true) String storeName, Instant createdAt, @Schema(nullable = true) Instant lastLoginAt) {

    public static AdminUserDto of(User user, Store store) {
        List<RoleName> roles = user.getRoles().stream().map(Role::getName).sorted().toList();
        return new AdminUserDto(user.getId(), user.getDisplayName(), user.getEmail(), user.getPhone(), roles,
                user.getStatus(), user.isEmailVerified(), user.isPhoneVerified(), store == null ? null : store.getId(),
                store == null ? null : store.getName(), user.getCreatedAt(), user.getLastLoginAt());
    }
}
