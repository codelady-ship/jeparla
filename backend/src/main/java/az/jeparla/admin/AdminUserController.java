package az.jeparla.admin;

import az.jeparla.admin.dto.AdminUserDto;
import az.jeparla.admin.dto.UserRoleRequest;
import az.jeparla.admin.dto.UserStatusRequest;
import az.jeparla.auth.RoleName;
import az.jeparla.auth.UserStatus;
import az.jeparla.common.dto.PageDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Accounts and roles (#40, PLAN 5.8). ADMIN only, every change audited. */
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: users", description = "Account list, role and blocking (ADMIN)")
public class AdminUserController {

    private final AdminUserService users;

    public AdminUserController(AdminUserService users) {
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "Accounts, newest first; filter by stored role and status, search by email or phone")
    public PageDto<AdminUserDto> list(@RequestParam(required = false) RoleName role,
            @RequestParam(required = false) UserStatus status,
            @Parameter(description = "Part of the email (any case) or of the phone number")
            @RequestParam(required = false) @Size(max = 254) String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return users.list(role, status, q, page, size);
    }

    @GetMapping("/{id}")
    public AdminUserDto get(@PathVariable long id) {
        return users.get(id);
    }

    @PostMapping("/{id}/role")
    @Operation(summary = "Set the role: USER or MERCHANT (ADMIN is never granted through the API)")
    @ApiResponse(responseCode = "200", description = "Saved; the user's token carries it from the next refresh")
    @ApiResponse(responseCode = "400", description = "admin.role_not_assignable (ADMIN)")
    @ApiResponse(responseCode = "409", description = "admin.self, admin.last_admin, admin.user_owns_store")
    public AdminUserDto changeRole(@PathVariable long id, @Valid @RequestBody UserRoleRequest request) {
        return users.changeRole(id, request);
    }

    @PostMapping("/{id}/status")
    @Operation(summary = "Block (reason) or unblock an account",
            description = "Blocking ends the account's sessions (refresh tokens revoked). Its store stays as it is.")
    @ApiResponse(responseCode = "200", description = "Saved")
    @ApiResponse(responseCode = "400", description = "admin.reason_required (blocking needs 10+ characters)")
    @ApiResponse(responseCode = "409", description = "admin.self, admin.last_admin")
    public AdminUserDto changeStatus(@PathVariable long id, @Valid @RequestBody UserStatusRequest request) {
        return users.changeStatus(id, request);
    }
}
