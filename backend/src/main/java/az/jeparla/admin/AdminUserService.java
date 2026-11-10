package az.jeparla.admin;

import az.jeparla.admin.dto.AdminUserDto;
import az.jeparla.admin.dto.UserRoleRequest;
import az.jeparla.admin.dto.UserStatusRequest;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.RefreshTokenService;
import az.jeparla.auth.Role;
import az.jeparla.auth.RoleName;
import az.jeparla.auth.RoleRepository;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.auth.UserStatus;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts in the admin panel (#40, PLAN 5.8): the list, the role and blocking. Every change is audited
 * ({@code USER} target). Safety rules:
 * <ul>
 *   <li>an admin never changes their own role or status ({@code admin.self});</li>
 *   <li>at least one active admin always remains ({@code admin.last_admin}); changes that could remove an admin
 *       are serialized by a lock on the ADMIN role row, so two admins cannot demote each other at once;</li>
 *   <li>ADMIN is not granted through the API (docs/RBAC.md), and a store owner keeps MERCHANT.</li>
 * </ul>
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserService {

    private static final int MIN_REASON = 10;

    private final UserRepository users;
    private final RoleRepository roles;
    private final StoreRepository stores;
    private final RefreshTokenService refreshTokens;
    private final AuditService audit;

    public AdminUserService(UserRepository users, RoleRepository roles, StoreRepository stores,
            RefreshTokenService refreshTokens, AuditService audit) {
        this.users = users;
        this.roles = roles;
        this.stores = stores;
        this.refreshTokens = refreshTokens;
        this.audit = audit;
    }

    /**
     * Accounts, newest first. {@code q} matches a part of the email (any case) or of the phone digits
     * ("050 123", "+99450123" and "50123" all find +994501234567).
     */
    @Transactional(readOnly = true)
    public PageDto<AdminUserDto> list(RoleName role, UserStatus status, String q, int page, int size) {
        Page<User> found = users.findAll(filter(role, status, q),
                AdminPages.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        Map<Long, Store> storesByOwner = found.isEmpty() ? Map.of()
                : stores.findByOwnerIdIn(found.map(User::getId).toList()).stream()
                        .collect(Collectors.toMap(s -> s.getOwner().getId(), Function.identity(), (a, b) -> a));
        return PageDto.of(found, user -> AdminUserDto.of(user, storesByOwner.get(user.getId())));
    }

    @Transactional(readOnly = true)
    public AdminUserDto get(long id) {
        User user = users.findWithRolesById(id).orElseThrow(ApiException::notFound);
        return AdminUserDto.of(user, stores.findByOwnerId(id).orElse(null));
    }

    /** Sets the account's role to exactly {@code request.role()}; the same role again changes nothing. */
    @Transactional
    public AdminUserDto changeRole(long id, UserRoleRequest request) {
        RoleName to = request.role();
        if (to == RoleName.ADMIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.role_not_assignable", "role");
        }
        requireNotSelf(id);
        users.lockAdminRole();
        User user = users.findWithRolesById(id).orElseThrow(ApiException::notFound);
        List<RoleName> from = user.getRoles().stream().map(Role::getName).sorted().toList();
        if (from.equals(List.of(to))) {
            return get(id);
        }
        Store store = stores.findByOwnerId(id).orElse(null);
        if (store != null && to != RoleName.MERCHANT) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.user_owns_store", "role");
        }
        if (user.hasRole(RoleName.ADMIN)) {
            requireAnotherActiveAdmin(user);
        }
        for (Role role : List.copyOf(user.getRoles())) {
            user.removeRole(role);
        }
        user.addRole(roles.findByName(to).orElseThrow());
        users.flush();
        audit.record("USER_ROLE_CHANGED", AuditTargetType.USER, user.getId(), user.getDisplayName(),
                blankToNull(request.reason()), AuditDetails.of("from", String.join(",", from.stream().map(Enum::name)
                        .toList()), "to", to));
        return AdminUserDto.of(user, store);
    }

    /** BLOCKED (reason) or ACTIVE; the same status again changes nothing. */
    @Transactional
    public AdminUserDto changeStatus(long id, UserStatusRequest request) {
        requireNotSelf(id);
        users.lockAdminRole();
        User user = users.findWithRolesById(id).orElseThrow(ApiException::notFound);
        UserStatus from = user.getStatus();
        UserStatus to = request.status();
        if (from == to) {
            return get(id);
        }
        String reason;
        if (to == UserStatus.BLOCKED) {
            reason = requireReason(request.reason());
            if (user.hasRole(RoleName.ADMIN)) {
                requireAnotherActiveAdmin(user);
            }
            user.setStatus(UserStatus.BLOCKED);
            refreshTokens.revokeAllOf(user.getId());
        } else {
            reason = blankToNull(request.reason());
            user.setStatus(UserStatus.ACTIVE);
        }
        users.flush();
        audit.record(to == UserStatus.BLOCKED ? "USER_BLOCKED" : "USER_UNBLOCKED", AuditTargetType.USER, user.getId(),
                user.getDisplayName(), reason, AuditDetails.of("from", from, "to", to));
        return AdminUserDto.of(user, stores.findByOwnerId(id).orElse(null));
    }

    // ------------------------------------------------------------------ helpers

    private static void requireNotSelf(long id) {
        if (CurrentUser.id() == id) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.self");
        }
    }

    /** Called with the ADMIN role row locked: {@code user} is an admin about to lose the role or be blocked. */
    private void requireAnotherActiveAdmin(User user) {
        long active = users.countActiveAdmins();
        long remaining = user.getStatus() == UserStatus.ACTIVE ? active - 1 : active;
        if (remaining < 1) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.last_admin");
        }
    }

    private static Specification<User> filter(RoleName role, UserStatus status, String q) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (role != null) {
                Subquery<Long> withRole = query.subquery(Long.class);
                var other = withRole.from(User.class);
                Join<User, Role> roleJoin = other.join("roles");
                withRole.select(other.get("id")).where(cb.equal(other.get("id"), root.get("id")),
                        cb.equal(roleJoin.get("name"), role));
                predicates.add(cb.exists(withRole));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            String text = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);
            if (!text.isEmpty()) {
                List<Predicate> matches = new ArrayList<>();
                matches.add(cb.like(cb.lower(root.get("email")), "%" + escapeLike(text) + "%", '\\'));
                String digits = text.replaceAll("[^0-9]", "").replaceFirst("^0+", "");
                if (digits.length() >= 3) {
                    matches.add(cb.like(root.get("phone"), "%" + digits + "%"));
                }
                predicates.add(cb.or(matches.toArray(Predicate[]::new)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String requireReason(String reason) {
        String stripped = reason == null ? "" : reason.strip();
        if (stripped.length() < MIN_REASON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "reason");
        }
        return stripped;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
