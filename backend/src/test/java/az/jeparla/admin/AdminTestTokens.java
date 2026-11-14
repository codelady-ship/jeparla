package az.jeparla.admin;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/** Access tokens of the admin API tests. */
final class AdminTestTokens {

    private AdminTestTokens() {
    }

    /** A token with the ADMIN role for {@code userId} (the account itself may have other roles in the database). */
    static JwtRequestPostProcessor admin(long userId) {
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
