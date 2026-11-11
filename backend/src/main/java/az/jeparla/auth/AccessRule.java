package az.jeparla.auth;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * One URL rule of the API (docs/RBAC.md, "URL rules"): who may call the paths, for one HTTP method or all.
 * {@link SecurityConfig#RULES} lists every rule in order; the first match decides and a request that matches
 * none is denied (#134). {@code SecurityRuleCoverageTests} fails when a controller mapping has no rule.
 *
 * @param method   the HTTP method, or null for every method
 * @param patterns path patterns ({@code PathPattern} syntax, e.g. {@code /api/v1/stores/**})
 * @param access   who may call them
 */
public record AccessRule(HttpMethod method, List<String> patterns, Access access) {

    /** Who may call a path. */
    public enum Access {
        /** Everyone, anonymous included. */
        PUBLIC,
        /** Any signed-in user (USER, MERCHANT or ADMIN). */
        AUTHENTICATED,
        MERCHANT,
        ADMIN,
        /** Nobody, whatever the token. */
        NOBODY
    }

    public AccessRule {
        Objects.requireNonNull(access);
        patterns = List.copyOf(patterns);
        if (patterns.isEmpty()) {
            throw new IllegalArgumentException("An access rule needs at least one path pattern");
        }
    }

    /** Rule for one HTTP method. */
    public static AccessRule of(HttpMethod method, Access access, String... patterns) {
        return new AccessRule(Objects.requireNonNull(method), Arrays.asList(patterns), access);
    }

    /** Rule for every HTTP method. */
    public static AccessRule anyMethod(Access access, String... patterns) {
        return new AccessRule(null, Arrays.asList(patterns), access);
    }

    /** The request matcher of this rule. */
    public RequestMatcher matcher() {
        PathPatternRequestMatcher.Builder path = PathPatternRequestMatcher.withDefaults();
        RequestMatcher[] matchers = patterns.stream()
                .map(pattern -> method == null ? path.matcher(pattern) : path.matcher(method, pattern))
                .toArray(RequestMatcher[]::new);
        return matchers.length == 1 ? matchers[0] : new OrRequestMatcher(matchers);
    }
}
