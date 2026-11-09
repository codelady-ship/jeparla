package az.jeparla.auth;

import jakarta.servlet.DispatcherType;
import java.util.Arrays;
import java.util.Map;
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
 *   <li>URL rules are the coarse layer; services check roles again with {@code @PreAuthorize} and
 *       ownership with {@code StoreAccess} / {@code ProductAccess}.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    /** Strict policy for JSON responses; Swagger UI (HTML + scripts) is excluded. */
    static final String CONTENT_SECURITY_POLICY =
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    private static final String[] PUBLIC_AUTH_ENDPOINTS = {
        "/api/v1/auth/register", "/api/v1/auth/register/merchant", "/api/v1/auth/login",
        "/api/v1/auth/refresh", "/api/v1/auth/logout"
    };

    private static final String[] PUBLIC_PRODUCT_POSTS = {
        "/api/v1/products/{id}/reports", "/api/v1/products/{id}/contact-click"
    };

    private static final String[] API_DOCS = {"/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**"};

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, ProblemSecurityHandlers problems,
            JwtAuthenticationConverter jwtAuthenticationConverter) throws Exception {
        PathPatternRequestMatcher.Builder path = PathPatternRequestMatcher.withDefaults();
        RequestMatcher apiDocs = new OrRequestMatcher(
                Arrays.stream(API_DOCS).map(path::matcher).toArray(RequestMatcher[]::new));

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
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(new NegatedRequestMatcher(apiDocs),
                                new StaticHeadersWriter("Content-Security-Policy", CONTENT_SECURITY_POLICY))))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/actuator", "/actuator/**").denyAll()
                        .requestMatchers(API_DOCS).permitAll()
                        .requestMatchers(HttpMethod.POST, PUBLIC_AUTH_ENDPOINTS).permitAll()
                        .requestMatchers("/api/v1/auth/**").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasRole(RoleName.ADMIN.name())
                        .requestMatchers("/api/v1/merchant/**").hasRole(RoleName.MERCHANT.name())
                        // Public catalog: products, stores, categories, search, metal prices.
                        .requestMatchers(HttpMethod.GET, "/api/v1/**").permitAll()
                        // Guests may report a product and are counted when they open WhatsApp (#37);
                        // both are rate limited in the controller.
                        .requestMatchers(HttpMethod.POST, PUBLIC_PRODUCT_POSTS).permitAll()
                        .anyRequest().authenticated())
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
     * seed accounts) never match.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();
        DelegatingPasswordEncoder encoder = new DelegatingPasswordEncoder("bcrypt", Map.of("bcrypt", bcrypt));
        encoder.setDefaultPasswordEncoderForMatches(new NeverMatchingPasswordEncoder());
        return encoder;
    }

    private static final class NeverMatchingPasswordEncoder implements PasswordEncoder {

        @Override
        public String encode(CharSequence rawPassword) {
            throw new UnsupportedOperationException("Only used for matching unknown hash formats");
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            return false;
        }
    }
}
