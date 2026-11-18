package az.jeparla.auth;

import az.jeparla.auth.AccessRule.Access;
import jakarta.servlet.DispatcherType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Stateless API security (docs/RBAC.md).
 *
 * <ul>
 *   <li>Every request is anonymous or carries {@code Authorization: Bearer <access JWT>}. No HTTP
 *       session, no form login, no basic auth.</li>
 *   <li>CSRF protection is off: no cookie authenticates API calls. The only cookie is the refresh
 *       token, sent only to {@code /api/v1/auth} ({@code Path}), only from our own site
 *       ({@code SameSite=Strict}), and CORS rejects other origins.</li>
 *   <li>URL rules ({@link #RULES}) are the coarse layer and deny everything they do not name (#134);
 *       services check roles again with {@code @PreAuthorize} and ownership with
 *       {@code StoreAccess} / {@code ProductAccess}.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    /** Strict policy for JSON responses; Swagger UI (HTML + scripts) is excluded while it is enabled. */
    static final String CONTENT_SECURITY_POLICY =
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    /**
     * OpenAPI document and Swagger UI: off unless {@code JEPARLA_API_DOCS=true} (#134). The paths stay public,
     * so that with the docs off they answer 404 like any other unknown public path.
     */
    static final String[] API_DOCS = {"/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**"};

    /**
     * Every URL rule, in order: the first match decides, and a request that matches none is denied (#134). A
     * new endpoint needs its rule here, or SecurityRuleCoverageTests fails.
     */
    static final List<AccessRule> RULES = List.of(
            AccessRule.anyMethod(Access.PUBLIC, "/actuator/health", "/actuator/health/**"),
            AccessRule.anyMethod(Access.NOBODY, "/actuator", "/actuator/**"),
            AccessRule.of(HttpMethod.GET, Access.PUBLIC, API_DOCS),
            AccessRule.of(HttpMethod.POST, Access.PUBLIC,
                    "/api/v1/auth/register", "/api/v1/auth/register/merchant", "/api/v1/auth/login",
                    "/api/v1/auth/refresh", "/api/v1/auth/logout",
                    // Password reset and email verification links (#131): the caller is not signed in.
                    "/api/v1/auth/password/forgot", "/api/v1/auth/password/reset", "/api/v1/auth/email/verify"),
            // Includes POST /api/v1/auth/email/verification (resend the verification link, #131).
            AccessRule.anyMethod(Access.AUTHENTICATED, "/api/v1/auth/**"),
            AccessRule.anyMethod(Access.ADMIN, "/api/v1/admin", "/api/v1/admin/**"),
            AccessRule.anyMethod(Access.MERCHANT, "/api/v1/merchant", "/api/v1/merchant/**"),
            // A user's own notifications (#138) and saved products (#41): private, GET included.
            AccessRule.anyMethod(Access.AUTHENTICATED, "/api/v1/notifications", "/api/v1/notifications/**"),
            AccessRule.anyMethod(Access.AUTHENTICATED, "/api/v1/favorites", "/api/v1/favorites/**"),
            // The public catalog, listed path by path: a new private GET is never public by accident.
            AccessRule.of(HttpMethod.GET, Access.PUBLIC,
                    "/api/v1/products", "/api/v1/products/**", "/api/v1/variants",
                    "/api/v1/stores", "/api/v1/stores/**", "/api/v1/categories", "/api/v1/categories/**",
                    "/api/v1/finenesses", "/api/v1/search", "/api/v1/search/**", "/api/v1/metal-prices/**",
                    "/api/v1/exchange-rates/**",
                    // A store's share link /s/{code} (#100).
                    "/api/v1/share/{code}"),
            // Guests may report a product or a store and are counted when they open WhatsApp (#37, #40) or
            // arrive through a shared store link (#100); all are rate limited in the controller or service.
            AccessRule.of(HttpMethod.POST, Access.PUBLIC,
                    "/api/v1/products/{id}/reports", "/api/v1/products/{id}/contact-click",
                    "/api/v1/stores/{id}/reports", "/api/v1/stores/{slug}/visits"),
            // Visits from an AI assistant's answer (#62), reported by the site server; rate limited in the service.
            AccessRule.of(HttpMethod.POST, Access.PUBLIC, "/api/v1/visits/ai"),
            // Search by photo (#163): anonymous, rate limited in the controller; the photo is never stored.
            AccessRule.of(HttpMethod.POST, Access.PUBLIC, "/api/v1/search/image"),
            // Internal jobs (#44) check their own shared secret (InternalJobController).
            AccessRule.of(HttpMethod.POST, Access.PUBLIC, "/internal/jobs/metal-prices"));

    /**
     * @param extraRules rules from other configurations, applied after {@link #RULES}. Only tests declare some
     *                   (for their test-only endpoints); production rules belong in {@link #RULES}.
     * @param apiDocs    whether Swagger UI is on ({@code JEPARLA_API_DOCS}); only then is its CSP relaxed
     */
    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, ProblemSecurityHandlers problems,
            JwtAuthenticationConverter jwtAuthenticationConverter, ObjectProvider<AccessRule> extraRules,
            @Value("${springdoc.swagger-ui.enabled:false}") boolean apiDocs) throws Exception {
        PathPatternRequestMatcher.Builder path = PathPatternRequestMatcher.withDefaults();
        RequestMatcher strictCsp = apiDocs
                ? new NegatedRequestMatcher(new OrRequestMatcher(
                        Arrays.stream(API_DOCS).map(path::matcher).toArray(RequestMatcher[]::new)))
                : AnyRequestMatcher.INSTANCE;
        List<AccessRule> rules = new ArrayList<>(RULES);
        extraRules.orderedStream().forEach(rules::add);

        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER))
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(strictCsp,
                                new StaticHeadersWriter("Content-Security-Policy", CONTENT_SECURITY_POLICY))))
                .authorizeHttpRequests(auth -> {
                    auth.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll();
                    for (AccessRule rule : rules) {
                        var url = auth.requestMatchers(rule.matcher());
                        switch (rule.access()) {
                            case PUBLIC -> url.permitAll();
                            case AUTHENTICATED -> url.authenticated();
                            case MERCHANT -> url.hasRole(RoleName.MERCHANT.name());
                            case ADMIN -> url.hasRole(RoleName.ADMIN.name());
                            case NOBODY -> url.denyAll();
                        }
                    }
                    // Default deny (#134): a path without a rule answers 401 (anonymous) or 403, never data.
                    auth.anyRequest().denyAll();
                })
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter))
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems));
        return http.build();
    }

    /**
     * ADMIN and MERCHANT can do everything a USER can (favorites, reports). ADMIN does not imply
     * MERCHANT: admins act through /api/v1/admin, never as a store owner.
     */
    @Bean
    static RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
                .role(RoleName.ADMIN.name()).implies(RoleName.USER.name())
                .role(RoleName.MERCHANT.name()).implies(RoleName.USER.name())
                .build();
    }

    /**
     * BCrypt (cost 10) behind a delegating encoder, so hashes carry their algorithm ({@code {bcrypt}...})
     * and a later upgrade (Argon2) can re-hash on login. Hashes without a known prefix (the demo
     * seed accounts) never match, after the same BCrypt work as a real check (#134), so the answer time
     * does not tell them apart.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();
        DelegatingPasswordEncoder encoder = new DelegatingPasswordEncoder("bcrypt", Map.of("bcrypt", bcrypt));
        encoder.setDefaultPasswordEncoderForMatches(new NeverMatchingPasswordEncoder(bcrypt));
        return encoder;
    }

    /** Never matches, but spends one BCrypt comparison against a random hash first. */
    static final class NeverMatchingPasswordEncoder implements PasswordEncoder {

        private final BCryptPasswordEncoder bcrypt;
        private final String decoyHash;

        NeverMatchingPasswordEncoder(BCryptPasswordEncoder bcrypt) {
            this.bcrypt = bcrypt;
            this.decoyHash = bcrypt.encode(UUID.randomUUID().toString());
        }

        @Override
        public String encode(CharSequence rawPassword) {
            throw new UnsupportedOperationException("Only used for matching unknown hash formats");
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            bcrypt.matches(rawPassword == null ? "" : rawPassword, decoyHash);
            return false;
        }
    }
}
