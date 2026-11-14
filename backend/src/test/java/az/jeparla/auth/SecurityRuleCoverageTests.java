package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.auth.AccessRule.Access;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.util.ClassUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Default deny (#134): every endpoint of every controller has an explicit URL rule in {@link SecurityConfig#RULES}.
 * A new controller method without one would answer 401/403 to everybody; this test names it instead. No Spring
 * context and no database: the mappings are read from the annotations, the rules are plain data.
 */
class SecurityRuleCoverageTests {

    /** {@code "GET /api/v1/stores/{slug}"} of every production controller method, with its first matching rule. */
    private static Map<String, Optional<AccessRule>> endpoints() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        Map<String, Optional<AccessRule>> endpoints = new LinkedHashMap<>();
        for (BeanDefinition candidate : scanner.findCandidateComponents("az.jeparla")) {
            Class<?> controller = ClassUtils.forName(candidate.getBeanClassName(), null);
            if (isTestOnly(controller)) {
                continue;
            }
            RequestMapping base = AnnotatedElementUtils.findMergedAnnotation(controller, RequestMapping.class);
            for (var method : controller.getDeclaredMethods()) {
                RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null) {
                    continue;
                }
                for (String path : join(base, mapping)) {
                    RequestMethod[] verbs = mapping.method().length == 0 ? RequestMethod.values() : mapping.method();
                    for (RequestMethod verb : verbs) {
                        endpoints.put(verb + " " + path, ruleFor(verb.name(), path));
                    }
                }
            }
        }
        return endpoints;
    }

    /** Test-only controllers are nested in a {@code @TestConfiguration} and declare their rules as beans. */
    private static boolean isTestOnly(Class<?> controller) {
        Class<?> enclosing = controller.getEnclosingClass();
        return enclosing != null && enclosing.isAnnotationPresent(TestConfiguration.class);
    }

    private static List<String> join(RequestMapping base, RequestMapping mapping) {
        String[] prefixes = base == null || base.path().length == 0 ? new String[] {""} : base.path();
        String[] suffixes = mapping.path().length == 0 ? new String[] {""} : mapping.path();
        List<String> paths = new ArrayList<>();
        for (String prefix : prefixes) {
            for (String suffix : suffixes) {
                paths.add(prefix + suffix);
            }
        }
        return paths;
    }

    /** The first rule that matches a request to {@code path} with every {@code {variable}} set to 1. */
    private static Optional<AccessRule> ruleFor(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path.replaceAll("\\{[^/]+}", "1"));
        return SecurityConfig.RULES.stream().filter(rule -> rule.matcher().matches(request)).findFirst();
    }

    private static Access accessOf(String method, String path) {
        return ruleFor(method, path).map(AccessRule::access).orElse(null);
    }

    @Test
    void everyEndpointHasAnExplicitRule() throws Exception {
        Map<String, Optional<AccessRule>> endpoints = endpoints();
        assertThat(endpoints).as("controller mappings found").hasSizeGreaterThan(50)
                .containsKeys("GET /api/v1/products/{slug}", "POST /api/v1/auth/login", "GET /api/v1/admin/audit");
        List<String> uncovered = endpoints.entrySet().stream()
                .filter(e -> e.getValue().isEmpty())
                .map(Map.Entry::getKey)
                .toList();
        assertThat(uncovered).as("endpoints without a rule in SecurityConfig.RULES (they would deny everybody)")
                .isEmpty();
        List<String> unreachable = endpoints.entrySet().stream()
                .filter(e -> e.getValue().filter(rule -> rule.access() == Access.NOBODY).isPresent())
                .map(Map.Entry::getKey)
                .toList();
        assertThat(unreachable).as("endpoints nobody may call").isEmpty();
    }

    @Test
    void roleAreasAndPrivateListsAreNeverPublic() throws Exception {
        endpoints().forEach((endpoint, rule) -> {
            String path = endpoint.substring(endpoint.indexOf(' ') + 1);
            Access access = rule.map(AccessRule::access).orElseThrow();
            if (path.startsWith("/api/v1/admin")) {
                assertThat(access).as(endpoint).isEqualTo(Access.ADMIN);
            } else if (path.startsWith("/api/v1/merchant")) {
                assertThat(access).as(endpoint).isEqualTo(Access.MERCHANT);
            } else if (path.startsWith("/api/v1/notifications") || path.startsWith("/api/v1/favorites")
                    || path.equals("/api/v1/auth/me")) {
                assertThat(access).as(endpoint).isEqualTo(Access.AUTHENTICATED);
            }
        });
    }

    @Test
    void getsOutsideTheCatalogListAreDenied() {
        // A private GET added later is denied until it gets its own rule (#134).
        assertThat(accessOf("GET", "/api/v1/xyz")).isNull();
        assertThat(accessOf("GET", "/api/v1/users/1/documents")).isNull();
        assertThat(accessOf("GET", "/api/v1/test/ping")).isNull();
        assertThat(accessOf("DELETE", "/api/v1/products/1")).isNull();
        assertThat(accessOf("PUT", "/api/v1/stores/ayzer-zerger")).isNull();
        assertThat(accessOf("GET", "/internal/jobs/metal-prices")).isNull();
        // The catalog itself is public.
        assertThat(accessOf("GET", "/api/v1/products")).isEqualTo(Access.PUBLIC);
        assertThat(accessOf("GET", "/api/v1/stores/ayzer-zerger/products")).isEqualTo(Access.PUBLIC);
        assertThat(accessOf("GET", "/api/v1/search/suggest")).isEqualTo(Access.PUBLIC);
        assertThat(accessOf("GET", "/api/v1/favorites")).isEqualTo(Access.AUTHENTICATED);
        assertThat(accessOf("GET", "/actuator/env")).isEqualTo(Access.NOBODY);
    }
}
