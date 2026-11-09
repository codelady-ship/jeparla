package az.jeparla.auth;

import java.util.Optional;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * The signed-in user of the current request, from the verified access token. The id is the JWT
 * {@code sub}; it is never taken from a request body or path.
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    /** User id, or 401 ({@link AuthenticationCredentialsNotFoundException}) when nobody is signed in. */
    public static long id() {
        return idIfPresent().orElseThrow(() -> new AuthenticationCredentialsNotFoundException("No signed-in user"));
    }

    public static Optional<Long> idIfPresent() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken
                || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.valueOf(authentication.getName()));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** Whether the token carries the role itself (the role hierarchy is not applied here). */
    public static boolean hasRole(RoleName role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        String authority = "ROLE_" + role.name();
        for (GrantedAuthority granted : authentication.getAuthorities()) {
            if (authority.equals(granted.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
