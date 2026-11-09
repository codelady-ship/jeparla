package az.jeparla.auth.dto;

import az.jeparla.auth.RoleName;
import az.jeparla.auth.User;
import java.util.List;

/**
 * The signed-in account, as the frontend session needs it ({@code frontend/src/lib/auth/session.ts}).
 *
 * @param role  the main role: ADMIN, else MERCHANT, else USER (where the frontend sends the user)
 * @param roles every role of the account
 */
public record UserResponse(
        long id,
        String name,
        String email,
        String phone,
        RoleName role,
        List<RoleName> roles,
        String locale) {

    public static UserResponse of(User user) {
        List<RoleName> roles = user.getRoles().stream().map(r -> r.getName()).sorted().toList();
        RoleName main = roles.contains(RoleName.ADMIN) ? RoleName.ADMIN
                : roles.contains(RoleName.MERCHANT) ? RoleName.MERCHANT : RoleName.USER;
        return new UserResponse(user.getId(), user.getDisplayName(), user.getEmail(), user.getPhone(), main, roles,
                user.getPreferredLocale().code());
    }
}
